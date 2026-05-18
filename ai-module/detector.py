import numpy as np
import joblib
import os
import re
import logging
from datetime import datetime
from collections import defaultdict
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

MODEL_PATH  = os.environ.get('MODEL_PATH', '/app/models/anomaly_model.pkl')
SCALER_PATH = os.environ.get('SCALER_PATH', '/app/models/scaler.pkl')

# Heuristic patterns
SUSPICIOUS_PATHS = [
    r'\.env', r'\/etc\/passwd', r'\.\./', r'\/admin\/',
    r'\/wp-admin', r'\/phpmyadmin', r'\/\.git',
    r'union.*select', r'<script', r'javascript:',
]
SUSPICIOUS_AGENTS = [r'sqlmap', r'nikto', r'nmap', r'masscan', r'zgrab', r'nuclei']
BOT_AGENTS        = [r'bot', r'crawler', r'spider', r'scraper']

SUSPICIOUS_PATH_RE  = re.compile('|'.join(SUSPICIOUS_PATHS), re.IGNORECASE)
SUSPICIOUS_AGENT_RE = re.compile('|'.join(SUSPICIOUS_AGENTS), re.IGNORECASE)
BOT_AGENT_RE        = re.compile('|'.join(BOT_AGENTS), re.IGNORECASE)

# Sliding window: ip → list of timestamps
_request_windows: dict = defaultdict(list)
WINDOW_SECONDS = 60
SPIKE_THRESHOLD = 30   # requests per window considered anomalous for AI scoring


class AnomalyDetector:
    def __init__(self):
        self.model   = None
        self.scaler  = None
        self.is_trained = False
        self._analysis_count = 0
        self._anomaly_count  = 0
        self._load_model()

    # ── Model persistence ────────────────────────────────────────────────────

    def _load_model(self):
        try:
            if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
                self.model   = joblib.load(MODEL_PATH)
                self.scaler  = joblib.load(SCALER_PATH)
                self.is_trained = True
                logger.info('Pre-trained model loaded from disk.')
            else:
                logger.info('No saved model found — will use heuristics only until trained.')
        except Exception as e:
            logger.warning(f'Could not load model: {e}')

    def _save_model(self):
        os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
        joblib.dump(self.model,  MODEL_PATH)
        joblib.dump(self.scaler, SCALER_PATH)
        logger.info('Model saved to disk.')

    # ── Feature extraction ───────────────────────────────────────────────────

    def _extract_features(self, event: dict) -> np.ndarray:
        """
        Convert a raw request event dict into a numeric feature vector.
        Features:
          0  hour_of_day          (0-23)
          1  is_suspicious_path   (0/1)
          2  is_suspicious_agent  (0/1)
          3  is_bot_agent         (0/1)
          4  method_is_post       (0/1)
          5  path_length          (normalised)
          6  req_rate_last_min    (count)
          7  is_authenticated     (0/1)
          8  path_depth           (number of / segments)
          9  has_query_params     (0/1)
        """
        ts_str = event.get('timestamp', datetime.utcnow().isoformat())
        try:
            ts = datetime.fromisoformat(ts_str.replace('Z', '+00:00'))
        except Exception:
            ts = datetime.utcnow()

        path       = event.get('path', '/')
        user_agent = event.get('userAgent', '')
        method     = event.get('method', 'GET').upper()
        ip         = event.get('ip', '0.0.0.0')
        user_id    = event.get('userId')

        # Sliding-window request rate
        now = datetime.utcnow().timestamp()
        window = [t for t in _request_windows[ip] if now - t < WINDOW_SECONDS]
        window.append(now)
        _request_windows[ip] = window
        req_rate = len(window)

        features = np.array([
            ts.hour,
            1 if SUSPICIOUS_PATH_RE.search(path)  else 0,
            1 if SUSPICIOUS_AGENT_RE.search(user_agent) else 0,
            1 if BOT_AGENT_RE.search(user_agent)  else 0,
            1 if method == 'POST'                  else 0,
            min(len(path) / 200.0, 1.0),           # normalised 0-1
            req_rate,
            1 if user_id and user_id != 'anonymous' else 0,
            path.count('/'),
            1 if '?' in path                        else 0,
        ], dtype=float)

        return features.reshape(1, -1)

    # ── Heuristic scoring (no model required) ───────────────────────────────

    def _heuristic_score(self, event: dict, features: np.ndarray) -> tuple[float, str]:
        """Returns (score 0-1, reason string). Higher = more anomalous."""
        score  = 0.0
        reasons = []
        f = features[0]

        if f[1]:  # suspicious path
            score += 0.5
            reasons.append('suspicious path pattern')
        if f[2]:  # suspicious agent
            score += 0.4
            reasons.append('known attack tool user-agent')
        if f[3]:  # bot agent
            score += 0.15
            reasons.append('bot/crawler user-agent')
        if f[6] > SPIKE_THRESHOLD:
            score += min((f[6] - SPIKE_THRESHOLD) / 20.0, 0.3)
            reasons.append(f'request spike ({int(f[6])}/min)')

        # High-risk hours (2 AM – 5 AM UTC)
        if 2 <= f[0] <= 5:
            score += 0.05
            reasons.append('off-hours request')

        score = min(score, 1.0)
        reason = '; '.join(reasons) if reasons else 'normal'
        return score, reason

    # ── Public API ───────────────────────────────────────────────────────────

    def analyze(self, event: dict) -> dict:
        self._analysis_count += 1
        features = self._extract_features(event)
        h_score, reason = self._heuristic_score(event, features)

        ml_score = 0.0
        if self.is_trained:
            try:
                scaled = self.scaler.transform(features)
                # IsolationForest: score_samples returns negative values;
                # more negative = more anomalous. Convert to 0-1.
                raw = self.model.score_samples(scaled)[0]
                # Typical range is roughly [-0.5, 0.1]; map to [0,1]
                ml_score = float(np.clip((-raw - 0.0) / 0.5, 0, 1))
            except Exception as e:
                logger.warning(f'ML scoring failed: {e}')

        # Combine heuristic (60%) + ML (40%)
        combined = h_score * 0.6 + ml_score * 0.4
        is_anomaly = combined > 0.35 or h_score >= 0.4

        if is_anomaly:
            self._anomaly_count += 1

        return {
            'anomaly':    is_anomaly,
            'score':      round(combined, 4),
            'heuristic':  round(h_score, 4),
            'ml_score':   round(ml_score, 4),
            'reason':     reason,
            'timestamp':  datetime.utcnow().isoformat(),
        }

    def train(self, logs: list) -> dict:
        """
        Train / retrain the Isolation Forest on a list of log-event dicts.
        Returns a dict of training metrics.
        """
        if len(logs) < 20:
            raise ValueError('Need at least 20 log samples to train.')

        feature_matrix = np.vstack([self._extract_features(e) for e in logs])

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(feature_matrix)

        self.model = IsolationForest(
            n_estimators=200,
            contamination=0.05,   # assume 5% anomalous in training data
            random_state=42,
            n_jobs=-1,
        )
        self.model.fit(X_scaled)
        self.is_trained = True
        self._save_model()

        predictions = self.model.predict(X_scaled)
        n_anomalies = int((predictions == -1).sum())

        return {
            'samples':    len(logs),
            'features':   feature_matrix.shape[1],
            'anomalies_found': n_anomalies,
            'contamination':   0.05,
        }

    def get_stats(self) -> dict:
        return {
            'is_trained':      self.is_trained,
            'analysis_count':  self._analysis_count,
            'anomaly_count':   self._anomaly_count,
            'anomaly_rate':    round(self._anomaly_count / max(self._analysis_count, 1), 4),
        }
