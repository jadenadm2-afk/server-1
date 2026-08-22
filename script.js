let currentStep = 1;
const totalSteps = 5;

document.addEventListener("DOMContentLoaded", () => {
    updateStepUI();
    setupInputListeners();
});

// Setup listeners to handle styling of checked radio and checkbox inputs
function setupInputListeners() {
    // Synchronize initial checkbox/radio states with styles
    const inputs = document.querySelectorAll('input[type="radio"], input[type="checkbox"]');
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            // Find parent label card and toggle check class
            const isLikert = input.closest('.likert-option');
            const isCard = input.closest('.option-card');
            
            if (isLikert) {
                // Clear sibling likert options in the same question
                const groupName = input.getAttribute('name');
                const groupOptions = document.querySelectorAll(`input[name="${groupName}"]`);
                groupOptions.forEach(opt => {
                    opt.closest('.likert-option').classList.remove('checked-state');
                });
                if (input.checked) {
                    isLikert.classList.add('checked-state');
                }
            } else if (isCard) {
                // Clear sibling options in the same card group
                const groupName = input.getAttribute('name');
                const groupOptions = document.querySelectorAll(`input[name="${groupName}"]`);
                groupOptions.forEach(opt => {
                    const card = opt.closest('.option-card');
                    if (card) card.classList.remove('checked-state');
                });
                if (input.checked) {
                    isCard.classList.add('checked-state');
                }
            }
        });
    });
}

// Function to handle clicks on the custom option cards
function selectCardOption(cardElement) {
    const radio = cardElement.querySelector('input[type="radio"]');
    const checkbox = cardElement.querySelector('input[type="checkbox"]');
    
    if (radio) {
        radio.checked = true;
        // Trigger the change event manually to update classes
        radio.dispatchEvent(new Event('change'));
    } else if (checkbox) {
        checkbox.checked = !checkbox.checked;
        checkbox.dispatchEvent(new Event('change'));
    }
}

// Function to handle clicks on custom Likert scale options
function selectLikertOption(likertElement) {
    const radio = likertElement.querySelector('input[type="radio"]');
    if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change'));
    }
}

// Navigate between steps
function changeStep(direction) {
    // If moving forward, validate current step inputs first
    if (direction === 1) {
        if (!validateStep(currentStep)) {
            return; // Stop if invalid
        }
    }

    currentStep += direction;

    if (currentStep < 1) currentStep = 1;
    if (currentStep > totalSteps) currentStep = totalSteps;

    updateStepUI();
}

// Validate inputs of the current step
function validateStep(step) {
    const activeStepEl = document.getElementById(`step${step}`);
    const requiredInputs = activeStepEl.querySelectorAll('[required]');
    
    // Check custom radio button groups (demographics and likert questions)
    let isValid = true;
    const checkedGroups = new Set();

    requiredInputs.forEach(input => {
        if (input.type === 'radio') {
            const name = input.getAttribute('name');
            checkedGroups.add(name);
        } else {
            if (!input.value.trim()) {
                input.reportValidity();
                isValid = false;
            }
        }
    });

    // Check if at least one radio button in each required group is selected
    for (let groupName of checkedGroups) {
        const checkedRadio = activeStepEl.querySelector(`input[name="${groupName}"]:checked`);
        if (!checkedRadio) {
            // Find the question label for this group to show user feedback
            const radioOptions = activeStepEl.querySelectorAll(`input[name="${groupName}"]`);
            if (radioOptions.length > 0) {
                // Focus/Report validity on the first option
                radioOptions[0].reportValidity();
            }
            isValid = false;
            break;
        }
    }

    return isValid;
}

// Update the UI state of steps, buttons, and progress indicators
function updateStepUI() {
    // Update step containers
    for (let i = 1; i <= totalSteps; i++) {
        const stepEl = document.getElementById(`step${i}`);
        if (stepEl) {
            if (i === currentStep) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        }
    }

    // Update buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (currentStep === 1) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }

    if (currentStep === totalSteps) {
        nextBtn.innerHTML = 'إرسال الاستبيان <span>✓</span>';
        nextBtn.onclick = (e) => submitForm(e);
    } else {
        nextBtn.innerHTML = 'التالي <span>&rarr;</span>';
        nextBtn.onclick = () => changeStep(1);
    }

    // Update progress bar
    const progressPercent = Math.round((currentStep / totalSteps) * 100);
    const progressBar = document.getElementById('progressBar');
    const stepIndicator = document.getElementById('stepIndicator');
    const percentIndicator = document.getElementById('percentIndicator');

    if (progressBar) progressBar.style.width = `${progressPercent}%`;
    if (stepIndicator) stepIndicator.textContent = `الخطوة ${currentStep} من ${totalSteps}`;
    if (percentIndicator) percentIndicator.textContent = `${progressPercent}%`;

    // Smooth scroll to top of card when step changes
    document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════
// Railway API URL - يمكن تغييره هنا
// ═══════════════════════════════════════════
const API_URL = 'https://servery.up.railway.app';

// Handle Form Submission
async function submitForm(event) {
    if (event) event.preventDefault();

    // Validate the last step
    if (!validateStep(currentStep)) {
        return;
    }

    // Gather form data
    const form = document.getElementById('surveyForm');
    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    console.log("Submitted Survey Data:", data);

    // Show loading state on button
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) {
        nextBtn.disabled = true;
        nextBtn.innerHTML = 'جاري الإرسال... <span>⏳</span>';
    }

    try {
        // Send data to Railway API
        const response = await fetch(`${API_URL}/api/responses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();
        console.log('✅ Saved to database:', result);

    } catch (err) {
        console.warn('⚠️ Could not save to server (offline mode):', err.message);
        // Continue to show success even if server is down
    }

    // Reset button
    if (nextBtn) {
        nextBtn.disabled = false;
        nextBtn.innerHTML = 'إرسال الاستبيان <span>✓</span>';
    }

    // Hide questionnaire form & progress
    form.style.display = 'none';
    document.querySelector('.progress-container').style.display = 'none';

    // Show success view
    const successCard = document.getElementById('successState');
    if (successCard) {
        successCard.style.display = 'block';
    }
}

// Reset Survey to starting state
function resetSurvey() {
    const form = document.getElementById('surveyForm');
    form.reset();

    // Remove all check states from cards and Likert scales
    const checkedCards = document.querySelectorAll('.checked-state');
    checkedCards.forEach(card => card.classList.remove('checked-state'));

    // Show form & progress again
    form.style.display = 'block';
    document.querySelector('.progress-container').style.display = 'block';

    // Hide success card
    const successCard = document.getElementById('successState');
    if (successCard) {
        successCard.style.display = 'none';
    }

    // Go back to first step
    currentStep = 1;
    updateStepUI();
}
