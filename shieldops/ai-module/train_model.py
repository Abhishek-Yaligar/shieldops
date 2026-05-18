"""
train_model.py — seed the Isolation Forest with synthetic normal traffic.
Run once inside the container or during CI to pre-bake a model:
    python train_model.py
"""
import json
import random
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from detector import AnomalyDetector
from datetime import datetime, timedelta

def generate_normal_event(base_time: datetime) -> dict:
    paths = ['/users', '/data/process', '/data/stats', '/auth/login', '/health']
    agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'axios/1.6.0',
    ]
    methods = ['GET', 'POST', 'PUT']
    return {
        'timestamp': (base_time + timedelta(seconds=random.randint(0, 3600))).isoformat(),
        'ip':        f'192.168.{random.randint(1,10)}.{random.randint(1,254)}',
        'method':    random.choices(methods, weights=[5, 3, 1])[0],
        'path':      random.choice(paths),
        'userAgent': random.choice(agents),
        'userId':    f'user_{random.randint(1,50)}',
        'userRole':  random.choice(['user', 'admin']),
    }

def generate_anomalous_event(base_time: datetime) -> dict:
    suspicious_paths = ['/../etc/passwd', '/.env', '/admin/config', '/wp-admin']
    suspicious_agents = ['sqlmap/1.7', 'nikto/2.1.6', 'nmap scripting engine']
    return {
        'timestamp': base_time.isoformat(),
        'ip':        f'10.0.{random.randint(0,255)}.{random.randint(1,254)}',
        'method':    random.choice(['GET', 'POST']),
        'path':      random.choice(suspicious_paths),
        'userAgent': random.choice(suspicious_agents),
        'userId':    'anonymous',
        'userRole':  'none',
    }

if __name__ == '__main__':
    base = datetime.utcnow()
    n_normal    = 950
    n_anomalous = 50   # ~5% contamination

    logs = [generate_normal_event(base) for _ in range(n_normal)]
    logs += [generate_anomalous_event(base) for _ in range(n_anomalous)]
    random.shuffle(logs)

    print(f'Training on {len(logs)} samples ({n_anomalous} anomalous)...')
    detector = AnomalyDetector()
    metrics  = detector.train(logs)
    print(f'Training complete: {json.dumps(metrics, indent=2)}')
