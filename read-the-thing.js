// Create a namespace for our reader functions
window.reader = (function() {
    let currentBook = null;
    let currentRendition = null;
    let isProcessingLargeFile = false;
    
    // Check if JSZip is available
    function checkJSZip() {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip is not loaded. EPUB files require JSZip to extract content.');
        }
        console.log("JSZip available:", typeof JSZip !== 'undefined');
    }
    
    function showLoadingScreen(message, progress) {
        const loadingScreen = document.getElementById('loadingScreen');
        const statusMessage = document.getElementById('statusMessage');
        const progressFill = document.getElementById('progressFill');
        
        if (loadingScreen) loadingScreen.classList.remove('hidden');
        if (statusMessage) statusMessage.textContent = message;
        if (progressFill) progressFill.style.width = progress + '%';
    }
    
    function hideLoadingScreen() {
        console.log("Attempting to hide loading screen");
        const loadingScreen = document.getElementById('loadingScreen');
        console.log("Found loading screen element:", loadingScreen);
        
        if (loadingScreen) {
            console.log("Before hiding - display:", window.getComputedStyle(loadingScreen).display);
            loadingScreen.classList.add('hidden');
            console.log("After hiding - display:", window.getComputedStyle(loadingScreen).display);
            console.log("Loading screen hidden successfully");
        } else {
            console.error("Loading screen element not found");
        }
    }
    
    function cleanupPreviousBook() {
        if (currentRendition) {
            try {
                currentRendition.destroy();
            } catch (e) {
                console.warn("Error destroying rendition:", e);
            }
            currentRendition = null;
        }
        if (currentBook) {
            try {
                if (currentBook.destroy) {
                    currentBook.destroy();
                }
            } catch (e) {
                console.warn("Error destroying book:", e);
            }
            currentBook = null;
        }
        
        // Force garbage collection if possible
        if (isProcessingLargeFile) {
            try {
                if (window.gc) {
                    window.gc();
                }
            } catch (e) {
                console.log("Manual GC not available");
            }
            isProcessingLargeFile = false;
        }
    }
    
    // Improved chunked file reading for large files
    function readFileInChunks(file, chunkSize = 1024 * 1024 * 2) { // 2MB chunks by default
        return new Promise((resolve, reject) => {
            const fileSize = file.size;
            const chunks = [];
            let bytesRead = 0;
            let chunkIndex = 0;
            
            // Adjust chunk size based on file size
            const optimalChunkSize = Math.min(chunkSize, Math.max(1024 * 512, fileSize / 10));
            
            console.log(`Reading file in chunks. Size: ${(fileSize / (1024 * 1024)).toFixed(2)}MB, Chunk size: ${(optimalChunkSize / (1024 * 1024)).toFixed(2)}MB`);
            
            if (fileSize > 50 * 1024 * 1024) { // > 50MB
                isProcessingLargeFile = true;
                showLoadingScreen("Loading large file, this may take a moment...", 5);
            }
            
            function readNextChunk() {
                if (bytesRead >= fileSize) {
                    // All chunks read, combine into single ArrayBuffer
                    const totalBuffer = new Uint8Array(fileSize);
                    let offset = 0;
                    
                    for (const chunk of chunks) {
                        totalBuffer.set(chunk, offset);
                        offset += chunk.length;
                    }
                    
                    // Free chunk memory
                    chunks.length = 0;
                    resolve(totalBuffer.buffer);
                    return;
                }
                
                const reader = new FileReader();
                const slice = file.slice(bytesRead, bytesRead + optimalChunkSize);
                
                reader.onload = (e) => {
                    const chunkData = new Uint8Array(e.target.result);
                    chunks.push(chunkData);
                    bytesRead += chunkData.length;
                    
                    // Update progress
                    const percent = Math.round((bytesRead / fileSize) * 100);
                    const progress = 10 + percent * 0.4;
                    showLoadingScreen(`Loading file... ${percent}%`, progress);
                    
                    // Read next chunk with slight delay to prevent UI freeze
                    setTimeout(readNextChunk, 10);
                };
                
                reader.onerror = (e) => {
                    showLoadingScreen("Error reading file chunk", 0);
                    reject(new Error("File read error: " + e.target.error));
                };
                
                reader.readAsArrayBuffer(slice);
                chunkIndex++;
            }
            
            readNextChunk();
        });
    }
    
    // Optimized EPUB loading with memory management
    async function loadEPUB(file, targetElementId) {
        try {
            console.log("=== STARTING OPTIMIZED EPUB LOAD ===");
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
            console.log(`File size: ${fileSizeMB}MB`);
            
            showLoadingScreen("Starting EPUB load...", 5);
            
            // Check if JSZip is available
            checkJSZip();
            
            // Clean up previous book with memory cleanup
            cleanupPreviousBook();


            
            
            // Read file with chunked approach for large files
            showLoadingScreen("Reading EPUB file...", 20);
            const arrayBuffer = await readFileInChunks(file);
            console.log("File read successfully:", (arrayBuffer.byteLength / (1024 * 1024)).toFixed(2), "MB");
            
            // Load from ArrayBuffer directly
            showLoadingScreen("Parsing EPUB structure...", 70);
            currentBook = ePub(arrayBuffer);
            
            // Wait for book to be ready with timeout for large files
            showLoadingScreen("Loading book content...", 85);
            await Promise.race([
                currentBook.ready,
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error("Book loading timeout")), 30000) // 30 second timeout
                )
            ]);
            
            console.log("EPUB ready, rendering...");
            
            // Render the book with optimized settings for large files
            showLoadingScreen("Rendering book...", 95);
            await renderBook(targetElementId);
            
            // Success! - Use improved hiding logic
            // showLoadingScreen("Complete!", 100);
            console.log("Book loading complete, checking rendition status...");
            
            // Wait for any final rendering to complete with better logic
            setTimeout(() => {
                if (currentRendition) {
                    console.log("Rendition is ready, hiding loading screen");
                    hideLoadingScreen();
                } else {
                    console.log("Rendition not ready yet, waiting a bit more");
                    // If rendition isn't ready, wait a bit more
                    setTimeout(() => {
                        if (currentRendition) {
                            hideLoadingScreen();
                        } else {
                            console.warn("Rendition still not ready after additional wait, forcing hide");
                            hideLoadingScreen();
                        }
                    }, 1000);
                }
            }, 500);
            
            console.log(`EPUB loaded successfully! Size: ${fileSizeMB}MB`);
            
        } catch (error) {
            console.error("EPUB loading failed:", error);
            showLoadingScreen("Error: " + error.message, 0);
            setTimeout(() => {
                hideLoadingScreen();
                alert("Failed to load EPUB: " + error.message);
            }, 2000);
        }
    }
    
    async function renderBook(targetElementId) {
        try {
            const targetElement = document.getElementById(targetElementId);
            
            // Optimize rendering settings based on file size
            const renderOptions = {
                width: "100%",
                height: "100%",
                spread: "none",
                flow: "paginated",
                manager: "default"
            };
            
            // For very large books, use continuous flow to reduce memory
            if (isProcessingLargeFile) {
                renderOptions.flow = "scrolled";
                renderOptions.manager = "continuous";
                console.log("Using continuous flow for large file optimization");
            }
            
            // Render the book
            currentRendition = currentBook.renderTo(targetElement, renderOptions);
            
            // Apply optimized styling
            currentRendition.themes.register("default", {
                "body": {
                    "font-size": "18px",
                    "line-height": "1.6",
                    "font-family": "Georgia, serif",
                    "color": "#333",
                    "padding": "20px",
                    "background": "#fff"
                }
            });
            currentRendition.themes.select("default");
            
            // Display the book with error handling
            await currentRendition.display();
            
            // Set up event listeners
            setupBookEvents();
            
        } catch (error) {
            console.error("Rendering failed:", error);
            throw error;
        }
    }
    
    function setupBookEvents() {
        if (!currentRendition) return;
        
        currentRendition.on('rendered', function(section) {
            console.log("Section rendered");
            extractTextContent();
        });
        
        currentRendition.on('displayError', function(error) {
            console.error("Display error:", error);
        });
        
        // Memory optimization for large files
        if (isProcessingLargeFile) {
            currentRendition.on('relocated', function(location) {
                console.log("Location changed, managing memory");
                // Add slight delay to prevent memory spikes
                setTimeout(extractTextContent, 100);
            });
        }
    }
    
    function extractTextContent() {
        try {
            const iframe = document.querySelector('#area iframe');
            if (iframe && iframe.contentDocument) {
                const textContent = iframe.contentDocument.body.textContent;
                window.currentPageText = textContent;
                console.log("Text extracted:", textContent.length, "characters");
            }
        } catch (error) {
            console.log("Text extraction error:", error);
        }
    }
    
    function navigateToNextPage() {
        if (currentRendition) {
            try {
                currentRendition.next();
            } catch (error) {
                console.error("Next page error:", error);
            }
        }
    }
    
    function navigateToPrevPage() {
        if (currentRendition) {
            try {
                currentRendition.prev();
            } catch (error) {
                console.error("Previous page error:", error);
            }
        }
    }
    
    function readAloud() {
        if (window.currentPageText && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(window.currentPageText);
            speechSynthesis.speak(utterance);
        } else {
            alert("No text content available yet. Try turning the page first.");
        }
    }
    
    function getCurrentText() {
        return window.currentPageText || null;
    }
    
    function debugInfo() {
        console.log("=== DEBUG INFO ===");
        console.log("JSZip available:", typeof JSZip !== 'undefined');
        console.log("ePub available:", typeof ePub !== 'undefined');
        console.log("Current book:", currentBook);
        console.log("Current rendition:", currentRendition);
        console.log("Current text length:", window.currentPageText ? window.currentPageText.length : 0);
        console.log("Processing large file:", isProcessingLargeFile);
    }
    
    // Memory management utilities
    function forceGarbageCollection() {
        try {
            if (window.gc) {
                window.gc();
                console.log("Manual garbage collection triggered");
            } else if (window.CollectGarbage) {
                window.CollectGarbage();
                console.log("IE garbage collection triggered");
            }
        } catch (e) {
            console.log("Manual GC not available");
        }
    }
    
    // Public API
    return {
        loadEPUB: loadEPUB,
        navigateToNextPage: navigateToNextPage,
        navigateToPrevPage: navigateToPrevPage,
        readAloud: readAloud,
        getCurrentText: getCurrentText,
        debugInfo: debugInfo,
        forceGarbageCollection: forceGarbageCollection
    };
})();