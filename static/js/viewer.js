import * as pdfjsLib from '/static/js/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/static/js/pdf.worker.mjs';
window.viewerModuleStarted?.();

// ------------------------------------------------------------
// Application State & URL Parsing (Unified)
// ------------------------------------------------------------

let pdfDoc = null;
const isMobileViewport = window.matchMedia("(max-width: 700px)").matches;
let isDualView = !isMobileViewport;

// Safe query string extraction to catch dashboard chapter selections
const urlParams = new URLSearchParams(window.location.search);
const targetPage = parseInt(urlParams.get('page'), 10);
let pageNum = (!isNaN(targetPage) && targetPage > 0) ? targetPage : 1;

const container = document.getElementById("pdf-container");
if (container) {
    container.setAttribute("tabindex", "0");
    container.className = isDualView ? "dual-page" : "single-page";
}
document.getElementById("single-view-btn").classList.toggle("active", !isDualView);
document.getElementById("dual-view-btn").classList.toggle("active", isDualView);
const metaElement = document.getElementById("pdf-metadata");

function showLoadError(stage, details) {
    window.reportViewerStartupError(stage, details);
}

async function checkPdfAsset(pdfUrl) {
    let response;
    try {
        response = await fetch(pdfUrl, { method: "HEAD", cache: "no-store" });
    } catch (err) {
        const message = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        throw new Error(`Could not contact the PDF URL.\n${message}`);
    }

    const contentType = response.headers.get("content-type") || "(not provided)";
    const contentLength = response.headers.get("content-length") || "(not provided)";
    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status} ${response.statusText}\n` +
            `Content-Type: ${contentType}\n` +
            `URL: ${response.url || pdfUrl}`
        );
    }
    if (!contentType.toLowerCase().includes("application/pdf")) {
        throw new Error(
            `The server returned HTTP ${response.status}, but the response is not a PDF.\n` +
            `Content-Type: ${contentType}\n` +
            `Content-Length: ${contentLength}\n` +
            `URL: ${response.url || pdfUrl}`
        );
    }

    return `HTTP ${response.status}\nContent-Type: ${contentType}\nContent-Length: ${contentLength}`;
}

// ------------------------------------------------------------
// Load PDF
// ------------------------------------------------------------

if (metaElement) {
    const pdfUrl = metaElement.getAttribute("data-url");

    console.log("PDF URL:", pdfUrl);

    if (!pdfUrl || pdfUrl === "None" || pdfUrl === "null") {
        showLoadError("viewer configuration", "No PDF URL was provided by the server.");
    } else {
        container.textContent = "Checking PDF asset…";
        (async () => {
            let assetResponse;
            try {
                assetResponse = await checkPdfAsset(pdfUrl);
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                showLoadError("PDF HTTP check", `URL: ${new URL(pdfUrl, window.location.href).href}\n${message}`);
                return;
            }

            container.textContent = "Loading PDF…";
            try {
                pdfDoc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;

                if (pageNum > pdfDoc.numPages) {
                    pageNum = pdfDoc.numPages;
                }

                document.getElementById("page-count").textContent = pdfDoc.numPages;
                renderPages();
                if (container) container.focus();
            } catch (err) {
                const errorName = err instanceof Error ? err.name : "Error";
                const errorMessage = err instanceof Error ? err.message : String(err);
                const errorStack = err instanceof Error && err.stack ? `\n\nStack:\n${err.stack}` : "";
                showLoadError(
                    "PDF.js parsing/loading",
                    `URL: ${new URL(pdfUrl, window.location.href).href}\n` +
                    `PDF server response:\n${assetResponse}\n` +
                    `Browser: ${navigator.userAgent}\n` +
                    `${errorName}: ${errorMessage}${errorStack}`
                );
            }
        })();
    }
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
