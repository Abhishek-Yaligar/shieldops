from flask import Flask, request, jsonify
from detector import AnomalyDetector
from metrics import metrics_bp
import logging
import os

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.register_blueprint(metrics_bp)

detector = AnomalyDetector()

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'service': 'ai-module', 'model_trained': detector.is_trained})

@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Receive a request event from the API gateway and classify it.
    Returns: { anomaly: bool, score: float, reason: str }
    """
    try:
        event = request.get_json(force=True)
        if not event:
            return jsonify({'error': 'No event data provided'}), 400

        result = detector.analyze(event)
        logger.info(f"Analyzed event from {event.get('ip','?')} → anomaly={result['anomaly']} score={result['score']:.3f}")
        return jsonify(result)

    except Exception as e:
        logger.error(f"Analysis error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/train', methods=['POST'])
def train():
    """Trigger model retraining with provided log data."""
    try:
        body = request.get_json(force=True)
        logs = body.get('logs', [])
        if not logs:
            return jsonify({'error': 'No training logs provided'}), 400

        metrics = detector.train(logs)
        logger.info(f"Model retrained on {len(logs)} samples. Metrics: {metrics}")
        return jsonify({'message': 'Model retrained successfully', 'metrics': metrics})

    except Exception as e:
        logger.error(f"Training error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/stats', methods=['GET'])
def stats():
    return jsonify(detector.get_stats())

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
