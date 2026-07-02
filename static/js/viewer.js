import * as pdfjsLib from '/static/js/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/js/pdf.worker.mjs';

// ------------------------------------------------------------
// Application State
// ------------------------------------------------------------

let pdfDoc = null;
let isDualView = false;

const params = new URLSearchParams(window.location.search);
let pageNum = parseInt(params.get("page"), 10) || 1;

const container = document.getElementById("pdf-container");
container.setAttribute("tabindex", "0");
const metaElement = document.getElementById("pdf-metadata");

// ------------------------------------------------------------
// Load PDF
// ------------------------------------------------------------

if (metaElement) {

    const pdfUrl = metaElement.getAttribute("data-url");

    console.log("PDF URL:", pdfUrl);

    if (!pdfUrl || pdfUrl === "None" || pdfUrl === "null") {
        container.innerHTML = `
            <p style="color:red;text-align:center;">
                No PDF URL was provided.
            </p>
        `;
        throw new Error("Missing PDF URL.");
    }

    pdfjsLib.getDocument({ url: pdfUrl }).promise
        .then(pdf => {
            pdfDoc = pdf;
            document.getElementById("page-count").textContent = pdfDoc.numPages;
            renderPages();
            container.focus();
        })
        .catch(err => {
            console.error("PDF.js loading error:", err);
        });
}

// ------------------------------------------------------------
// Render Pages
// ------------------------------------------------------------

function renderPages() {

    container.innerHTML = "";

    renderSingleCanvas(pageNum);

    if (isDualView && pageNum + 1 <= pdfDoc.numPages) {
        renderSingleCanvas(pageNum + 1);
    }

    document.getElementById("page-num").textContent =
        (isDualView && pageNum + 1 <= pdfDoc.numPages)
            ? `${pageNum}-${pageNum + 1}`
            : pageNum;

    document.getElementById("jump-input").value = pageNum;
}

// ------------------------------------------------------------
// Render One Canvas
// ------------------------------------------------------------

function renderSingleCanvas(num) {

    pdfDoc.getPage(num).then(page => {

        const viewport = page.getViewport({ scale: 1.5 });

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        container.appendChild(canvas);

        page.render({
            canvasContext: ctx,
            viewport: viewport
        });

    });

}

// ------------------------------------------------------------
// Navigation Functions
// ------------------------------------------------------------

function previousPage() {

    if (!pdfDoc || pageNum <= 1) return;

    pageNum -= isDualView ? 2 : 1;

    if (pageNum < 1) {
        pageNum = 1;
    }

    renderPages();

}

function nextPage() {

    if (!pdfDoc || pageNum >= pdfDoc.numPages) return;

    const step = isDualView ? 2 : 1;

    if (pageNum + step <= pdfDoc.numPages) {
        pageNum += step;
    } else {
        pageNum = pdfDoc.numPages;
    }

    renderPages();

}

// ------------------------------------------------------------
// Buttons
// ------------------------------------------------------------

document.getElementById("prev-btn").addEventListener("click", previousPage);
document.getElementById("next-btn").addEventListener("click", nextPage);

// ------------------------------------------------------------
// View Mode
// ------------------------------------------------------------

document.getElementById("single-view-btn").addEventListener("click", e => {

    isDualView = false;
    container.className = "single-page";
    toggleActiveButton(e.target);
    renderPages();

});

document.getElementById("dual-view-btn").addEventListener("click", e => {

    isDualView = true;
    container.className = "dual-page";
    toggleActiveButton(e.target);
    renderPages();

});

function toggleActiveButton(target) {

    document
        .querySelectorAll("#view-mode-section button")
        .forEach(button => button.classList.remove("active"));

    target.classList.add("active");

}

// ------------------------------------------------------------
// Jump To Page
// ------------------------------------------------------------

function executePageJump() {

    if (!pdfDoc) return;

    let targetPage = parseInt(
        document.getElementById("jump-input").value,
        10
    );

    if (isNaN(targetPage) || targetPage < 1) {
        targetPage = 1;
    }

    if (targetPage > pdfDoc.numPages) {
        targetPage = pdfDoc.numPages;
    }

    pageNum = targetPage;

    document.getElementById("jump-input").value = pageNum;

    renderPages();

}

document
    .getElementById("jump-btn")
    .addEventListener("click", executePageJump);

document
    .getElementById("jump-input")
    .addEventListener("keypress", e => {

        if (e.key === "Enter") {
            executePageJump();
        }

    });

// ------------------------------------------------------------
// Keyboard Navigation
// ------------------------------------------------------------

document.addEventListener("keydown", e => {

    if (!pdfDoc) return;

    if (e.key === "ArrowLeft") {
        e.preventDefault();
        previousPage();
    }

    if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPage();
    }

});

// ------------------------------------------------------------
// Swipe Navigation
// ------------------------------------------------------------

let touchStartX = 0;
let touchEndX = 0;

document.addEventListener("touchstart", e => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener("touchend", e => {
    touchEndX = e.changedTouches[0].screenX;

    if (!pdfDoc) return;

    const diff = touchStartX - touchEndX;
    const threshold = 60;

    if (Math.abs(diff) < threshold) return;

    if (diff > 0) {
        nextPage();
    } else {
        previousPage();
    }
}, { passive: true });
