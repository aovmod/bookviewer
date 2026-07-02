import os
from flask import Flask, render_template, url_for, abort

app = Flask(__name__)

NOTES_DIR = os.path.join(app.root_path, 'static', 'lesson_notes')

@app.route('/')
def dashboard():
    # Ensure the directory exists to avoid application crashes
    if not os.path.exists(NOTES_DIR):
        os.makedirs(NOTES_DIR)
        
    # Read all files from the local directory and filter for PDFs
    all_files = os.listdir(NOTES_DIR)
    pdf_files = [f for f in all_files if f.lower().endswith('.pdf')]
    
    # Sort files alphabetically so lesson materials stay organized
    pdf_files.sort()
    
    return render_template('dashboard.html', files=pdf_files)

@app.route('/view/<filename>')
def view_pdf(filename):
    file_path = os.path.join(NOTES_DIR, filename)
    if not os.path.exists(file_path):
        abort(404)
    pdf_url = url_for('static', filename=f'lesson_notes/{filename}')
    return render_template('viewer.html', pdf_url=pdf_url, document_title=filename)

if __name__ == '__main__':
    app.run(debug=True)

