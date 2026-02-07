// Elements
const fileUpload = document.getElementById('fileUpload');
const fileName = document.getElementById('fileName');
const websiteName = document.getElementById('websiteName');
const deployBtn = document.getElementById('deployBtn');
const statusMessage = document.getElementById('statusMessage');
const resultCard = document.getElementById('resultCard');
const deployedUrl = document.getElementById('deployedUrl');
const newDeployBtn = document.getElementById('newDeployBtn');
const quotaDisplay = document.getElementById('quotaDisplay');
const quotaText = document.getElementById('quotaText');
const namePreview = document.getElementById('namePreview');

// ======== CONFIG ========
// INI YANG HARUS DICOCOKKAN DENGAN BACKEND KAMU
const API_URL = 'https://web-deploy-ditzx.vercel.app/api/deploy';
// ========================

let selectedFile = null;
let cooldownTimer = null;

// Check quota on load
checkQuota();

// Update name preview
websiteName.addEventListener('input', updateNamePreview);

function updateNamePreview() {
    const name = websiteName.value || 'nama-kamu';
    namePreview.textContent = `${name}.vercel.app`;
}

async function checkQuota() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: 'quota-check', 
                fileData: '', 
                fileName: 'check.html' 
            })
        });
        
        const data = await response.json();
        
        if (data.remainingQuota !== undefined) {
            updateQuotaDisplay(data.remainingQuota);
        }
        
        if (data.cooldown && data.remainingSeconds) {
            startCooldownTimer(data.remainingSeconds);
        }
    } catch (e) {
        quotaText.textContent = 'Quota: Error';
    }
}

function updateQuotaDisplay(remaining) {
    quotaText.textContent = `Quota: ${remaining}/50`;
    
    if (remaining <= 0) {
        quotaDisplay.classList.add('error');
        deployBtn.disabled = true;
        quotaText.innerHTML = `<i class="fas fa-ban"></i> Quota Habis`;
    } else if (remaining <= 10) {
        quotaDisplay.classList.add('warning');
        quotaText.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Quota: ${remaining}/50`;
    } else {
        quotaDisplay.classList.remove('warning', 'error');
        quotaText.innerHTML = `<i class="fas fa-check-circle"></i> Quota: ${remaining}/50`;
    }
}

function startCooldownTimer(seconds) {
    deployBtn.disabled = true;
    
    if (cooldownTimer) clearInterval(cooldownTimer);
    
    let remaining = seconds;
    
    const updateCooldown = () => {
        const minutes = Math.floor(remaining / 60);
        const secs = remaining % 60;
        quotaText.innerHTML = `<i class="fas fa-clock"></i> Cooldown: ${minutes}m ${secs}s`;
        quotaDisplay.classList.add('warning');
        
        if (remaining <= 0) {
            clearInterval(cooldownTimer);
            deployBtn.disabled = false;
            checkQuota();
        }
        remaining--;
    };
    
    updateCooldown();
    cooldownTimer = setInterval(updateCooldown, 1000);
}

// File upload handler
fileUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        fileName.textContent = file.name;
        fileName.innerHTML = `<i class="fas fa-file"></i> ${file.name}`;
        
        // Validate file type
        const validExtensions = ['.html', '.htm', '.zip'];
        const isValid = validExtensions.some(ext => 
            file.name.toLowerCase().endsWith(ext)
        );
        
        if (!isValid) {
            showStatus('error', 'Hanya file HTML/HTM atau ZIP yang diperbolehkan');
            selectedFile = null;
            fileName.textContent = 'Pilih file HTML atau ZIP';
            fileUpload.value = '';
        } else {
            showStatus('success', `File "${file.name}" siap di-deploy`);
        }
    }
});

// Website name validation
websiteName.addEventListener('input', (e) => {
    e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    updateNamePreview();
});

// Deploy button handler
deployBtn.addEventListener('click', async () => {
    if (!websiteName.value.trim()) {
        showStatus('error', 'Silakan masukkan nama website');
        websiteName.focus();
        return;
    }
    
    if (!selectedFile) {
        showStatus('error', 'Silakan pilih file untuk diupload');
        fileUpload.click();
        return;
    }
    
    // Start deployment
    await deployToVercel(websiteName.value.trim(), selectedFile);
});

// New deploy button
newDeployBtn.addEventListener('click', () => {
    resultCard.classList.add('hidden');
    websiteName.value = '';
    fileUpload.value = '';
    fileName.textContent = 'Pilih file HTML atau ZIP';
    selectedFile = null;
    statusMessage.classList.add('hidden');
    updateNamePreview();
    checkQuota();
});

// Show status message
function showStatus(type, message) {
    statusMessage.className = `status-message ${type}`;
    statusMessage.innerHTML = `<i class="fas fa-${getStatusIcon(type)}"></i> ${message}`;
    statusMessage.classList.remove('hidden');
}

function getStatusIcon(type) {
    switch(type) {
        case 'info': return 'info-circle';
        case 'success': return 'check-circle';
        case 'warning': return 'exclamation-triangle';
        case 'error': return 'times-circle';
        default: return 'info-circle';
    }
}

// ======== FIXED: BACA FILE YANG BENAR ========
function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        if (file.name.toLowerCase().endsWith('.html') || 
            file.name.toLowerCase().endsWith('.htm')) {
            
            // BACA HTML SEBAGAI TEXT (INI YANG DIPERBAIKI)
            reader.onload = function(e) {
                const text = e.target.result;
                
                // Convert text to base64 dengan encoding yang benar
                try {
                    const base64 = btoa(unescape(encodeURIComponent(text)));
                    resolve(base64);
                } catch (error) {
                    // Fallback untuk karakter khusus
                    const base64 = btoa(text);
                    resolve(base64);
                }
            };
            
            reader.onerror = reject;
            reader.readAsText(file, 'UTF-8');
            
        } else {
            // Untuk ZIP: baca sebagai DataURL (base64)
            reader.onload = function(e) {
                const base64 = e.target.result.split(',')[1];
                resolve(base64);
            };
            
            reader.onerror = reject;
            reader.readAsDataURL(file);
        }
    });
}

// ======== DEPLOY KE VERCEL ========
async function deployToVercel(name, file) {
    try {
        deployBtn.disabled = true;
        deployBtn.classList.add('loading');
        showStatus('info', 'Mempersiapkan deployment...');
        
        // 1. Baca file dengan method yang benar
        showStatus('info', 'Membaca file...');
        const fileData = await readFileAsBase64(file);
        
        // 2. Kirim ke API backend kamu
        showStatus('info', 'Mendeploy ke Vercel...');
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                fileData: fileData,
                fileName: file.name
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Handle cooldown
            if (data.cooldown && data.remainingSeconds) {
                startCooldownTimer(data.remainingSeconds);
            }
            
            // Update quota display
            if (data.remainingQuota !== undefined) {
                updateQuotaDisplay(data.remainingQuota);
            }
            
            throw new Error(data.error || 'Deploy gagal');
        }
        
        // SUKSES!
        deployBtn.disabled = false;
        deployBtn.classList.remove('loading');
        statusMessage.classList.add('hidden');
        
        // Update quota
        if (data.remainingQuota !== undefined) {
            updateQuotaDisplay(data.remainingQuota);
        }
        
        // Start cooldown (5 menit)
        startCooldownTimer(300);
        
        // Show result
        deployedUrl.href = data.url;
        deployedUrl.textContent = data.url.replace('https://', '');
        deployedUrl.innerHTML = `<i class="fas fa-external-link-alt"></i> ${data.url.replace('https://', '')}`;
        resultCard.classList.remove('hidden');
        
        // Auto-open website setelah 1 detik
        setTimeout(() => {
            window.open(data.url, '_blank');
        }, 1000);
        
    } catch (error) {
        console.error('Deployment error:', error);
        showStatus('error', `Deploy gagal: ${error.message}`);
        deployBtn.disabled = false;
        deployBtn.classList.remove('loading');
    }
}

// ======== DRAG & DROP SUPPORT ========
document.addEventListener('DOMContentLoaded', function() {
    const uploadZone = document.querySelector('.upload-zone');
    
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });
    
    uploadZone.addEventListener('dragleave', function() {
        uploadZone.classList.remove('drag-over');
    });
    
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length) {
            const file = e.dataTransfer.files[0];
            
            // Validate file type
            const validExtensions = ['.html', '.htm', '.zip'];
            const isValid = validExtensions.some(ext => 
                file.name.toLowerCase().endsWith(ext)
            );
            
            if (isValid) {
                selectedFile = file;
                fileName.textContent = file.name;
                fileName.innerHTML = `<i class="fas fa-file"></i> ${file.name}`;
                showStatus('success', `File "${file.name}" siap di-deploy`);
            } else {
                showStatus('error', 'Hanya file HTML atau ZIP yang diizinkan');
            }
        }
    });
});

// Initialize name preview
updateNamePreview();
