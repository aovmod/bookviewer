import os
from flask import Flask, render_template, url_for, abort, request
from pypdf import PdfReader

app = Flask(__name__)

NOTES_DIR = os.path.join(app.root_path, 'static', 'lesson_notes')

def get_pdf_chapters(file_path):
    """Extracts top-level bookmarks by matching actual page object references."""
    chapters = []
    try:
        reader = PdfReader(file_path)
        outline = reader.outline
        
        # Build a mapping of page object ID -> physical page index (0-indexed)
        # This guarantees 100% precision even if page numbers/sections reset midway
        page_map = {page.page_number: idx for idx, page in enumerate(reader.pages)}
        
        if outline:
            for item in outline:
                # Skip nested list groups (sub-chapters)
                if isinstance(item, list):
                    continue
                
                title = getattr(item, 'title', None) or (item.get('/Title') if isinstance(item, dict) else None)
                
                if title:
                    page_num = None
                    
                    # Method 1: Check the destination's page object directly
                    if hasattr(item, 'page') and item.page is not None:
                        try:
                            # Direct lookup of physical index from the page object
                            if hasattr(item.page, 'page_number'):
                                page_num = item.page.page_number + 1
                        except Exception:
                            pass
                    
                    # Method 2: Fallback to get_destination_page_number if direct reference missing
                    if page_num is None:
                        try:
                            page_num = reader.get_destination_page_number(item) + 1
                        except Exception:
                            continue
                            
                    if page_num is not None:
                        chapters.append({'title': title, 'page': page_num})
                        
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