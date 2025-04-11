from flask import Flask, request, jsonify
import re
import numpy as np
from nltk.translate.bleu_score import sentence_bleu
from rouge import Rouge
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import argon2
from argon2 import PasswordHasher
import os
import json
import base64
from dotenv import load_dotenv

app = Flask(__name__)
CORS(app)
load_dotenv()

SQLALCHEMY_DATABASE_URI = "mysql+mysqlconnector://{username}:{password}@{hostname}/{dbname}".format(
    username=os.getenv("DB_USERNAME"),
    password=os.getenv("DB_PASSWORD"),
    hostname=os.getenv("DB_HOST"),
    dbname=os.getenv("DB_NAME"),
)
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SQLALCHEMY_POOL_RECYCLE"] = 299
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB

db = SQLAlchemy(app)

PASSWORD_FILE = "/home/LLMGitCommitMessageHelper/mysite/password.txt"
PROMPTS_FILE = "/home/LLMGitCommitMessageHelper/mysite/prompts.json"

def get_password_hasher():
    return PasswordHasher(time_cost=2, memory_cost=2**16, parallelism=2, hash_len=32, salt_len=16)

ph = get_password_hasher()

class Submission(db.Model):
    __tablename__ = 'Submission'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    issue_report = db.Column(db.Text)
    commit_id = db.Column(db.String(255))
    commit_type = db.Column(db.String(100))
    original_message = db.Column(db.Text)
    pull_request_title = db.Column(db.Text)
    timestamp = db.Column(db.DateTime)

    file = db.relationship('File', backref='Submission', cascade="all, delete")
    ratings = db.relationship('Rating', backref='Submission', cascade="all, delete")


class File(db.Model):
    __tablename__ = 'File'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    submission_id = db.Column(db.BigInteger, db.ForeignKey('Submission.id'))
    additions = db.Column(db.Integer)
    changes = db.Column(db.Integer)
    deletions = db.Column(db.Integer)
    filename = db.Column(db.Text)
    patch = db.Column(db.Text(length=4294967295))
    sha = db.Column(db.String(255))
    status = db.Column(db.String(50))


class Rating(db.Model):
    __tablename__ = 'Rating'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    submission_id = db.Column(db.BigInteger, db.ForeignKey('Submission.id'))
    message = db.Column(db.Text)
    prompt_type = db.Column(db.String(255))
    accuracy = db.Column(db.Numeric(5, 2))
    applicability = db.Column(db.Numeric(5, 2))
    completeness = db.Column(db.Numeric(5, 2))
    integrity = db.Column(db.Numeric(5, 2))
    readability = db.Column(db.Numeric(5, 2))
    rationale = db.Column(db.Text)
    success = db.Column(db.Boolean, nullable=False)
    used_evaluate = db.Column(db.Boolean, nullable=False)

    metrics = db.relationship('Metric', back_populates='rating', cascade="all, delete-orphan")

class Metric(db.Model):
    __tablename__ = 'Metric'

    id = db.Column(db.BigInteger, primary_key=True, autoincrement=True)
    rating_id = db.Column(db.BigInteger, db.ForeignKey('Rating.id'))
    bleu_score = db.Column(db.Numeric(10, 5))
    meteor_score = db.Column(db.Numeric(10, 5))
    rouge_l_score = db.Column(db.Numeric(10, 5))

    rating = db.relationship('Rating', back_populates='metrics')



@app.route('/add_submission', methods=['POST'])
def add_submission():
    data = request.get_json()
    try:
        submission = Submission(
            issue_report=data.get('issue_report'),
            commit_id=data.get('commit_id'),
            commit_type=data.get('commit_type'),
            original_message=data.get('original_message'),
            pull_request_title=data.get('pull_request_title'),
            timestamp=datetime.utcnow()
        )
        db.session.add(submission)
        db.session.commit()

        if 'files' in data:
            for file_data in data['files']:
                print(file_data.get('patch'))
                file_entry = File(
                    submission_id=submission.id,
                    additions=file_data.get('additions'),
                    changes=file_data.get('changes'),
                    deletions=file_data.get('deletions'),
                    filename=file_data.get('filename'),
                    patch=file_data.get('patch'),
                    sha=file_data.get('sha'),
                    status=file_data.get('status')
                )
                db.session.add(file_entry)
                db.session.commit()

        if 'ratings' in data:
            for rating_data in data['ratings']:
                rating_entry = Rating(
                    submission_id=submission.id,
                    message=rating_data.get('message'),
                    prompt_type=rating_data.get('prompt_type'),
                    accuracy = rating_data.get('accuracy'),
                    applicability = rating_data.get('applicability'),
                    completeness = rating_data.get('completeness'),
                    integrity = rating_data.get('integrity'),
                    readability = rating_data.get('readability'),
                    rationale = rating_data.get('rationale'),
                    success=rating_data.get("success"),
                    used_evaluate=rating_data.get("used_evaluate")
                )
                db.session.add(rating_entry)
                db.session.commit()

                if 'metrics' in rating_data:
                    for metric_data in rating_data['metrics']:
                        metric_entry = Metric(
                            rating_id=rating_entry.id,
                            bleu_score=metric_data.get('bleuScore'),
                            meteor_score=metric_data.get('meteorScore'),
                            rouge_l_score=metric_data.get('rougeLScore')
                        )
                        db.session.add(metric_entry)

        db.session.commit()
        return jsonify({'message': 'Submission added successfully!', 'submission_id': submission.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@app.route('/')
def hello_world():
    return 'Hello from Flask!'

def calculate_meteor(sentence1, sentence2):
    """
    Compute METEOR-like score using cosine similarity.
    """
    vectorizer = CountVectorizer().fit([sentence1, sentence2])
    sentence1_vector = vectorizer.transform([sentence1])
    sentence2_vector = vectorizer.transform([sentence2])

    similarity = cosine_similarity(sentence1_vector, sentence2_vector)[0][0]
    score = 2 * similarity * len(sentence1) * len(sentence2) / (len(sentence1) + len(sentence2))
    return score

def calculate_bleu(reference, translation):
    """
    Compute BLEU score.
    """
    return sentence_bleu([reference.split()], translation.split())

def calculate_rouge_l(reference, translation):
    """
    Compute ROUGE-L score.
    """
    rouge = Rouge()
    return rouge.get_scores(translation, reference, avg=True)['rouge-l']['f']

def is_camel_case(s):
    return s != s.lower() and s != s.upper() and "_" not in s

def to_underline(x):
    """Convert CamelCase to space-separated words"""
    return re.sub(r'(?<=[a-z])[A-Z]|(?<!^)[A-Z](?=[a-z])', ' \g<0>', x).lower()

def process_text(msg):
    """Process text by converting CamelCase to spaced words."""
    words = msg.split()
    processed_words = [to_underline(word) if is_camel_case(word) else word for word in words]
    return ' '.join(processed_words)

@app.route('/evaluate_message', methods=['POST'])
def evaluate():
    data = request.get_json()
    original_message = data.get('original_message', '')
    ai_message = data.get('ai_message', '')

    # Process text
    original_message = process_text(original_message)
    ai_message = process_text(ai_message)

    # Compute scores
    bleu_score = calculate_bleu(original_message, ai_message)
    rouge_l_score = calculate_rouge_l(original_message, ai_message)
    meteor_score = calculate_meteor(original_message, ai_message)

    return jsonify({
        "METEOR Score": round(meteor_score, 4),
        "BLEU Score": round(bleu_score, 4),
        "ROUGE-L Score": round(rouge_l_score, 4)
    })


def write_password(plain_text_password):
    """Hashes and stores the password in the file."""
    hashed_password = ph.hash(plain_text_password)
    with open(PASSWORD_FILE, "w") as f:
        f.write(hashed_password)

def verify_password(plain_text_password):
    """Retrieves the stored password and verifies it."""
    if not os.path.exists(PASSWORD_FILE):
        raise FileNotFoundError("Password file does not exist.")

    with open(PASSWORD_FILE, "r") as f:
        stored_hash = f.read().strip()

    try:
        return ph.verify(stored_hash, plain_text_password)
    except Exception:
        return False

@app.route('/set_password', methods=['POST'])
def set_password():
    try:
        data = request.get_json()
        new_password = data.get('new_password', '')
        write_password(new_password)
        return jsonify({'message': 'Passwrd set successfully!'}), 201
    except Exception:
        return jsonify({"error": "Unexpected error."}), 500

@app.route('/get_submissions/<password>', methods=['GET'])
def get_submissions(password):
    try:
        verify_password(password)
    except argon2.exceptions.VerifyMismatchError:
        return jsonify({"error": "Wrong password."}), 403
    except FileNotFoundError:
        return jsonify({"error": "No password set."}), 400
    except Exception:
        return jsonify({"error": "Unexpected error."}), 400

    submissions = Submission.query.all()
    submission_list = [{
        "id": s.id,
        "issue_report": s.issue_report,
        "commit_id": s.commit_id,
        "commit_type": s.commit_type,
        "original_message": s.original_message,
        "pull_request_title": s.pull_request_title,
        "timestamp": s.timestamp,
        "files": [{
            "id": f.id,
            "filename": f.filename,
            "additions": f.additions,
            "changes": f.changes,
            "deletions": f.deletions,
            "patch": base64.b64decode(f.patch).decode('utf-8') if f.patch else None,
            "sha": f.sha,
            "status": f.status
        } for f in s.file],
        "ratings": [{
            "id": r.id,
            "message": r.message,
            "prompt_type": r.prompt_type,
            "accuracy": float(r.accuracy) if r.accuracy is not None else None,
            "applicability": float(r.applicability) if r.applicability is not None else None,
            "completeness": float(r.completeness) if r.completeness is not None else None,
            "integrity": float(r.integrity) if r.integrity is not None else None,
            "readability": float(r.readability) if r.readability is not None else None,
            "rationale": r.rationale if r.rationale is not None else None,
            "success": r.success,
            "used_evaluate": r.used_evaluate,
            "metrics": [{
                "id": m.id,
                "bleu_score": float(m.bleu_score),
                "meteor_score": float(m.meteor_score),
                "rouge_l_score": float(m.rouge_l_score)
            } for m in r.metrics]
        } for r in s.ratings]
    } for s in submissions]

    return jsonify({"submissions": submission_list}), 200

@app.route('/get_prompts', methods=['GET'])
def get_prompts():
    if not os.path.exists(PROMPTS_FILE):
        return jsonify({"error": "File not found"}), 404

    try:
        with open(PROMPTS_FILE, 'r', encoding='utf-8') as file:
            data = json.load(file)
        return jsonify(data)
    except json.JSONDecodeError:
        return jsonify({"error": "Invalid JSON format"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/add_prompt', methods=['POST'])
def add_prompt():
    try:
        data = request.get_json()
        message = data.get("message")
        prompt_type = data.get("promptType")

        if not message or not prompt_type:
            return jsonify({"error": "'message', 'promptType', and 'evaluate' are required"}), 400

        prompts = []
        if os.path.exists(PROMPTS_FILE):
            with open(PROMPTS_FILE, 'r', encoding='utf-8') as file:
                try:
                    prompts = json.load(file)
                except json.JSONDecodeError:
                    return jsonify({"error": "Invalid JSON format in file"}), 500

        next_id = max((p["id"] for p in prompts), default=0) + 1

        new_prompt = {
            "id": next_id,
            "message": message,
            "promptType": prompt_type,
            "evaluate": True
        }
        prompts.append(new_prompt)

        with open(PROMPTS_FILE, 'w', encoding='utf-8') as file:
            json.dump(prompts, file, indent=4)

        return jsonify({"success": True, "added": new_prompt}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/delete_prompt', methods=['DELETE'])
def delete_prompt():
    try:
        data = request.get_json()
        prompt_id = data.get("id")

        if prompt_id is None:
            return jsonify({"error": "An 'id' is required"}), 400

        if not os.path.exists(PROMPTS_FILE):
            return jsonify({"error": "File not found"}), 404

        with open(PROMPTS_FILE, 'r', encoding='utf-8') as file:
            try:
                prompts = json.load(file)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON format in file"}), 500

        updated_prompts = [p for p in prompts if p["id"] != prompt_id]

        if len(updated_prompts) == len(prompts):
            return jsonify({"error": f"Prompt with id {prompt_id} not found"}), 404

        for index, prompt in enumerate(updated_prompts, start=1):
            prompt["id"] = index

        with open(PROMPTS_FILE, 'w', encoding='utf-8') as file:
            json.dump(updated_prompts, file, indent=4)

        return jsonify({"success": True, "deleted_id": prompt_id, "remaining_prompts": updated_prompts}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/toggle_evaluate', methods=['PATCH'])
def toggle_evaluate():
    try:
        data = request.get_json()
        prompt_id = data.get("id")

        if prompt_id is None:
            return jsonify({"error": "An 'id' is required"}), 400

        if not os.path.exists(PROMPTS_FILE):
            return jsonify({"error": "File not found"}), 404

        with open(PROMPTS_FILE, 'r', encoding='utf-8') as file:
            try:
                prompts = json.load(file)
            except json.JSONDecodeError:
                return jsonify({"error": "Invalid JSON format in file"}), 500

        for prompt in prompts:
            if prompt["id"] == prompt_id:
                prompt["evaluate"] = not prompt.get("evaluate", False)

                with open(PROMPTS_FILE, 'w', encoding='utf-8') as file:
                    json.dump(prompts, file, indent=4)

                return jsonify({"success": True, "updated_prompt": prompt}), 200

        return jsonify({"error": f"Prompt with id {prompt_id} not found"}), 404

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

