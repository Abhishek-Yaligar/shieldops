from flask import Blueprint, Response
from prometheus_client import (
    Counter, Histogram, Gauge,
    generate_latest, CONTENT_TYPE_LATEST
)

metrics_bp = Blueprint('metrics', __name__)

# ── Prometheus metrics ────────────────────────────────────────────────────────
requests_total = Counter(
    'ai_module_requests_total',
    'Total analysis requests received',
    ['result']          # labels: anomaly / normal
)

analysis_duration = Histogram(
    'ai_module_analysis_duration_seconds',
    'Time spent analysing each event',
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

anomaly_score_gauge = Gauge(
    'ai_module_last_anomaly_score',
    'Score of the most recently analysed event'
)

model_trained_gauge = Gauge(
    'ai_module_model_trained',
    '1 if ML model is loaded, 0 otherwise'
)


@metrics_bp.route('/metrics')
def metrics():
    return Response(generate_latest(), mimetype=CONTENT_TYPE_LATEST)
