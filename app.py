import os
from flask import Flask, render_template, url_for, abort, request
from pypdf import PdfReader

app = Flask(__name__)

NOTES_DIR = os.path.join(app.root_path, 'static', 'lesson_notes')

def get_pdf_chapters(file_path):
    """Extracts top-level bookmarks and their target page numbers from a PDF."""
    chapters = []
    try:
        reader = PdfReader(file_path)
        outline = reader.outline
        
        # If the PDF has an outline structure
        if outline:
            for item in outline:
                # We only want top-level items that aren't nested lists
                if isinstance(item, dict) and '/Title' in item:
                    title = item['/Title']
                    # Look up the actual page number (0-indexed in pypdf, convert to 1-indexed)
                    try:
                        page_num = reader.get_destination_page_number(item) + 1
                        chapters.append({'title': title, 'page': page_num})
                    except Exception:
                        continue
    except Exception as e:
        print(f"Could not parse outline for {file_path}: {e}")
    return chapters

@app.route('/')
def dashboard():
    if not os.path.exists(NOTES_DIR):
        os.makedirs(NOTES_DIR)
        
    all_files = os.listdir(NOTES_DIR)
    pdf_files = [f for f in all_files if f.lower().endswith('.pdf')]
    pdf_files.sort()
    
    # Build a structured list containing files and their discovered chapters
    books_data = []
    for filename in pdf_files:
        file_path = os.path.join(NOTES_DIR, filename)
        chapters = get_pdf_chapters(file_path)
        books_data.append({
            'filename': filename,
            'chapters': chapters
        })
        
    return render_template('dashboard.html', books=books_data)

@app.route('/view/<filename>')
def view_pdf(filename):
    file_path = os.path.join(NOTES_DIR, filename)
    if not os.path.exists(file_path):
        abort(404)
        
    # Get the initial page query if it exists (e.g., /view/book.pdf?page=5)
    initial_page = request.args.get('page', default=1, type=int)
    pdf_url = url_for('static', filename=f'lesson_notes/{filename}')
    
    return render_template('viewer.html', pdf_url=pdf_url, document_title=filename, initial_page=initial_page)

if __name__ == '__main__':
    app.run(debug=True)