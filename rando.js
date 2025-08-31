// This file handles the UI interactions
function doThing() {
    document.getElementById('demo').innerHTML = Date();
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    console.log("Document loaded, setting up event listeners");
    
    // Set up the load button
    const loadButton = document.getElementById('loadButton');
    if (loadButton) {
        loadButton.addEventListener('click', function() {
            const fileInput = document.getElementById('input');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                alert("Please select an EPUB file first!");
                return;
            }
            
            const file = fileInput.files[0];
            console.log("Selected file:", file.name, "Size:", (file.size / 1024 / 1024).toFixed(2) + "MB");
            
            // Call the reader function
            if (window.reader && window.reader.loadEPUB) {
                window.reader.loadEPUB(file, 'area');
                
                // Show navigation controls
                const navControls = document.getElementById('navControls');
                if (navControls) {
                    navControls.classList.remove('hidden');
                }
            } else {
                console.error("Reader module not loaded");
                alert("Reader functionality not available. Please check the console for errors.");
            }
        });
    }
});