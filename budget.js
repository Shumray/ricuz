// Budget System - JavaScript Logic
class BudgetSystem {
    constructor() {
        this.transactions = [];
        this.mappings = new Map(); // item -> { category, includeInMonthlyExpenses }
        this.incomeItems = new Set();
        this.categories = [];
        this.openingBalances = new Map(); // Store opening balance per month per year
        this.monthlyNotes = new Map(); // Store monthly notes per year
        this.currentMonth = new Date().getMonth() + 1;
        this.currentYear = new Date().getFullYear();
        this.currentTab = 'data-entry';
        this.lastSelectedMonth = null; // Remember last selected month for new transactions
        this.lastSelectedYear = null; // Remember last selected year

        this.initialize();
    }

    // Initialize the system
    async initialize() {
        await this.initializeFromMappingsFile();
        this.loadData();
        this.initializeYearSelector();
        this.initializeEventListeners();
        this.setCurrentMonth();
        this.updateDisplay();
    }

    // Initialize from mappings.json file
    async initializeFromMappingsFile() {
        try {
            const response = await fetch('./mappings.json');
            const mappingsData = await response.json();
            
            // Load categories
            this.categories = mappingsData.categories || [];
            
            // Load income items
            this.incomeItems = new Set(mappingsData.incomeItems || []);
            
            // Load mappings - support both old (string) and new (object) format
            this.mappings = new Map();
            if (mappingsData.mappings) {
                Object.entries(mappingsData.mappings).forEach(([item, value]) => {
                    if (typeof value === 'string') {
                        // Old format: "item": "category"
                        this.mappings.set(item, {
                            category: value,
                            includeInMonthlyExpenses: false
                        });
                    } else {
                        // New format: "item": { category: "...", includeInMonthlyExpenses: true/false }
                        this.mappings.set(item, {
                            category: value.category,
                            includeInMonthlyExpenses: value.includeInMonthlyExpenses !== false
                        });
                    }
                });
            }
            
            console.log('Mappings loaded successfully from mappings.json');
        } catch (error) {
            console.error('Error loading mappings file, using fallback:', error);
            this.initializeDefaultMappings(); // Fallback to hardcoded mappings
        }
    }

    // Initialize default category mappings (fallback)
    initializeDefaultMappings() {
        // Define categories
        this.categories = [
            'חינוך ותרבות', 'טיפול רפואי', 'כלכלה', 'מיסים', 
            'נסיעות', 'ביגוד', 'משכורת', 'עמלת בנק', 'שונות'
        ];

        // Define income items
        this.incomeItems = new Set([
            'משכורת',
            'ביטוח לאומי', 
            'מענק עבודה'
        ]);

        const defaultMappings = [
            ['משכורת', 'משכורת'],
            ['ביטוח לאומי', 'משכורת'],
            ['מענק עבודה', 'משכורת'],
            ['סופרסל', 'כלכלה'],
            ['רמי לוי', 'כלכלה'],
            ['מגא', 'כלכלה'],
            ['ויקטורי', 'כלכלה'],
            ['אושר עד', 'כלכלה'],
            ['הראל', 'מיסים'],
            ['מנורה', 'מיסים'],
            ['פניקס', 'מיסים'],
            ['כרטיסיה', 'נסיעות'],
            ['מונית', 'נסיעות'],
            ['גט', 'נסיעות'],
            ['רב קו', 'נסיעות'],
            ['עמלת בנק', 'עמלת בנק'],
            ['רופא', 'טיפול רפואי'],
            ['בית מרקחת', 'טיפול רפואי'],
            ['רופא שיניים', 'טיפול רפואי'],
            ['ביגוד', 'ביגוד'],
            ['תספורת', 'ביגוד'],
            ['ספר', 'חינוך ותרבות'],
            ['קורס', 'חינוך ותרבות'],
            ['קולנוע', 'חינוך ותרבות']
        ];

        defaultMappings.forEach(([item, category]) => {
            this.mappings.set(item, category);
        });
    }

    // Initialize year selector
    initializeYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        const currentYear = new Date().getFullYear();
        
        // Use saved year if available, otherwise use current year
        const savedYear = this.lastSelectedYear;
        const selectedYear = savedYear || currentYear;
        this.currentYear = selectedYear;

        // Add years from 2023 to current year + 2
        for (let year = 2023; year <= currentYear + 2; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === selectedYear) {
                option.selected = true;
            }
            yearSelect.appendChild(option);
        }
        
        // Add event listener for year change
        yearSelect.addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.lastSelectedYear = this.currentYear;
            this.saveData();
            this.updateDisplay();
            this.showNotification(`עברת לשנת ${this.currentYear}`, 'info');
        });
    }

    // Set current month
    setCurrentMonth() {
        // Use saved month if available, otherwise use current month
        const savedMonth = this.lastSelectedMonth;
        const currentMonth = savedMonth || String(new Date().getMonth() + 1).padStart(2, '0');

        document.getElementById('monthSelect').value = currentMonth;
        document.getElementById('dashboardMonth').value = currentMonth;
        document.getElementById('dataEntryMonthSelect').value = currentMonth;
        this.currentMonth = parseInt(currentMonth);
    }

    // Initialize event listeners
    initializeEventListeners() {
        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Transaction form
        document.getElementById('addTransactionBtn').addEventListener('click', () => {
            this.showTransactionForm();
        });

        document.getElementById('cancelForm').addEventListener('click', () => {
            this.hideTransactionForm();
        });

        document.getElementById('newTransactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTransaction();
        });

        // Item autocomplete
        this.setupItemAutocomplete();

        // Check payment functionality
        this.setupCheckPayment();

        // Mapping form
        document.getElementById('addMappingBtn').addEventListener('click', () => {
            this.showMappingForm();
        });

        document.getElementById('cancelMapping').addEventListener('click', () => {
            this.hideMappingForm();
        });

        document.getElementById('newMappingForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addMapping();
        });

        // Month selectors
        document.getElementById('monthSelect').addEventListener('change', () => {
            this.updateMonthlyView();
        });

        document.getElementById('dashboardMonth').addEventListener('change', () => {
            this.updateDashboard();
        });

        // Data entry month filter
        document.getElementById('dataEntryMonthSelect').addEventListener('change', (e) => {
            const selectedValue = e.target.value;
            // Save the selected month if it's not "all"
            if (selectedValue && selectedValue !== 'all') {
                this.lastSelectedMonth = selectedValue;
                this.saveData();
            }
            this.updateTransactionsTable();
        });

        // Export monthly report
        document.getElementById('exportMonthlyReportBtn').addEventListener('click', () => {
            const selectedMonth = parseInt(document.getElementById('monthSelect').value);
            this.exportMonthlyReport(selectedMonth);
        });

        // Export/Import
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('exportMappingsBtn').addEventListener('click', () => {
            this.exportMappingsFile();
        });

        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('importFile').click();
        });

        document.getElementById('importFile').addEventListener('change', (e) => {
            this.importData(e.target.files[0]);
        });
    }

    // Tab switching
    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        // Update tab panels
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(tabId).classList.add('active');

        this.currentTab = tabId;

        // Update display based on current tab
        setTimeout(() => {
            if (tabId === 'monthly') {
                this.updateMonthlyView();
            } else if (tabId === 'dashboard') {
                this.updateDashboard();
            } else if (tabId === 'mapping') {
                this.updateMappingTable();
            }
        }, 100);
    }

    // Transaction management
    showTransactionForm(editData = null) {
        document.getElementById('transactionForm').style.display = 'block';
        
        if (editData) {
            // Fill form with existing data for editing
            document.getElementById('item').value = editData.item;
            document.getElementById('amount').value = Math.abs(editData.amount);
            document.getElementById('note').value = editData.note || '';
            
            // Handle check data
            const isCheck = editData.paymentMethod === 'check';
            document.getElementById('isCheck').checked = isCheck;
            if (isCheck && editData.checkDetails) {
                this.currentCheckData = editData.checkDetails;
            }
            
            // Change form title and button text
            document.querySelector('#transactionForm h3').textContent = 'עריכת עסקה';
            document.querySelector('#newTransactionForm button[type="submit"]').innerHTML = '💾 עדכן';
            
            // Store the ID for updating and remember the original month
            document.getElementById('newTransactionForm').dataset.editId = editData.id;
            document.getElementById('newTransactionForm').dataset.editMonth = editData.month;
        } else {
            // New transaction mode
            document.getElementById('isCheck').checked = false;
            delete this.currentCheckData;
            document.querySelector('#transactionForm h3').textContent = 'עסקה חדשה';
            document.querySelector('#newTransactionForm button[type="submit"]').innerHTML = '💾 שמור';
            delete document.getElementById('newTransactionForm').dataset.editId;
            delete document.getElementById('newTransactionForm').dataset.editMonth;
        }
        
        document.getElementById('item').focus();
    }

    hideTransactionForm() {
        document.getElementById('transactionForm').style.display = 'none';
        document.getElementById('newTransactionForm').reset();
        document.getElementById('isCheck').checked = false;
        delete this.currentCheckData;
        
        // Reset form to "new transaction" mode
        document.querySelector('#transactionForm h3').textContent = 'עסקה חדשה';
        document.querySelector('#newTransactionForm button[type="submit"]').innerHTML = '💾 שמור';
        delete document.getElementById('newTransactionForm').dataset.editId;
    }

    addTransaction() {
        const form = document.getElementById('newTransactionForm');
        const isEditing = !!form.dataset.editId;
        
        // For editing, use the original month; for new transactions, use the selected month from header
        const selectedMonth = isEditing
            ? parseInt(form.dataset.editMonth)
            : parseInt(document.getElementById('dataEntryMonthSelect').value);

        // Don't allow adding to "all months"
        if (!isEditing && (!selectedMonth || isNaN(selectedMonth))) {
            alert('אנא בחר חודש ספציפי להוספת עסקה חדשה');
            return;
        }

        const formData = {
            month: selectedMonth,
            item: document.getElementById('item').value.trim(),
            amount: parseFloat(document.getElementById('amount').value),
            note: document.getElementById('note').value.trim(),
            isCheck: document.getElementById('isCheck').checked
        };

        // Validate data
        if (!formData.month || !formData.item || isNaN(formData.amount)) {
            alert('אנא מלא את כל השדות החובה');
            return;
        }

        // Validate check data if needed
        if (formData.isCheck && !this.currentCheckData) {
            alert('אנא הזן את פרטי הצ\'יק');
            return;
        }


        // Determine type automatically
        const type = this.getTransactionType(formData.item);

        const transactionData = {
            month: formData.month,
            year: this.currentYear, // Add year to transaction
            item: formData.item,
            amount: type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount),
            type: type,
            category: this.getCategoryForItem(formData.item),
            note: formData.note,
            paymentMethod: formData.isCheck ? 'check' : 'cash',
            checkDetails: formData.isCheck ? this.currentCheckData : null
        };

        if (isEditing) {
            // Update existing transaction
            const editId = parseFloat(form.dataset.editId);
            const transactionIndex = this.transactions.findIndex(t => t.id === editId);
            
            if (transactionIndex !== -1) {
                this.transactions[transactionIndex] = {
                    ...this.transactions[transactionIndex],
                    ...transactionData
                };
                
                this.showNotification('העסקה עודכנה בהצלחה!', 'success');
            }
        } else {
            // Create new transaction
            const transaction = {
                id: Date.now() + Math.random(),
                ...transactionData
            };

            this.transactions.push(transaction);
            this.showNotification('העסקה נוספה בהצלחה!', 'success');
        }

        this.saveData();
        this.updateTransactionsTable();
        this.hideTransactionForm();
        this.updateDisplay();
    }

    getCategoryForItem(item) {
        // Try exact match first
        if (this.mappings.has(item)) {
            const mapping = this.mappings.get(item);
            return mapping.category || 'לא מקוטלג';
        }

        // Try partial match
        for (const [mappedItem, mapping] of this.mappings) {
            if (item.includes(mappedItem) || mappedItem.includes(item)) {
                return mapping.category || 'לא מקוטלג';
            }
        }

        return 'לא מקוטלג';
    }

    // Check if item should be included in monthly expenses
    shouldIncludeInMonthlyExpenses(item) {
        // Try exact match first
        if (this.mappings.has(item)) {
            const mapping = this.mappings.get(item);
            return mapping.includeInMonthlyExpenses === true;
        }

        // Try partial match
        for (const [mappedItem, mapping] of this.mappings) {
            if (item.includes(mappedItem) || mappedItem.includes(item)) {
                return mapping.includeInMonthlyExpenses === true;
            }
        }

        // Default: if no mapping found, include it (for backward compatibility)
        return true;
    }

    // Determine transaction type based on item name
    getTransactionType(item) {
        // Check for exact matches first
        if (this.incomeItems.has(item)) {
            return 'income';
        }

        // Check for partial matches in income items
        for (const incomeItem of this.incomeItems) {
            if (item.includes(incomeItem) || incomeItem.includes(item)) {
                return 'income';
            }
        }

        // Default to expense for everything else
        return 'expense';
    }

    // Setup item autocomplete functionality
    setupItemAutocomplete() {
        const itemInput = document.getElementById('item');
        let autocompleteContainer = null;
        let selectedIndex = -1;
        let isNewItemConfirmed = false;

        // Create autocomplete container
        const createAutocompleteContainer = () => {
            if (autocompleteContainer) {
                autocompleteContainer.remove();
            }
            
            autocompleteContainer = document.createElement('div');
            autocompleteContainer.className = 'autocomplete-container';
            autocompleteContainer.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                max-height: 200px;
                overflow-y: auto;
                box-shadow: 0 4px 15px rgba(0,0,0,0.1);
                z-index: 1000;
                display: none;
                width: ${itemInput.offsetWidth}px;
            `;
            
            // Position relative to input
            const rect = itemInput.getBoundingClientRect();
            autocompleteContainer.style.top = (rect.bottom + window.scrollY) + 'px';
            autocompleteContainer.style.left = (rect.left + window.scrollX) + 'px';
            
            document.body.appendChild(autocompleteContainer);
            return autocompleteContainer;
        };

        // Get matching items from mappings
        const getMatchingItems = (query) => {
            if (!query) return [];
            
            const mappingItems = Array.from(this.mappings.keys());
            return mappingItems.filter(item => 
                item.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 10); // Limit to 10 suggestions
        };

        // Show autocomplete suggestions
        const showAutocomplete = (items) => {
            if (!autocompleteContainer) {
                createAutocompleteContainer();
            }
            
            autocompleteContainer.innerHTML = '';
            selectedIndex = -1;
            
            if (items.length === 0) {
                autocompleteContainer.style.display = 'none';
                return;
            }
            
            items.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'autocomplete-item';
                div.style.cssText = `
                    padding: 10px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background-color 0.2s;
                `;
                div.textContent = item;
                
                div.addEventListener('mouseenter', () => {
                    selectedIndex = index;
                    updateSelection();
                });
                
                div.addEventListener('click', () => {
                    selectItem(item);
                });
                
                autocompleteContainer.appendChild(div);
            });
            
            autocompleteContainer.style.display = 'block';
        };

        // Update selection highlighting
        const updateSelection = () => {
            const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
            items.forEach((item, index) => {
                if (index === selectedIndex) {
                    item.style.backgroundColor = '#e3f2fd';
                } else {
                    item.style.backgroundColor = '';
                }
            });
        };

        // Select an item
        const selectItem = (item) => {
            itemInput.value = item;
            hideAutocomplete();
            isNewItemConfirmed = true;
            // Trigger focus to amount field
            document.getElementById('amount').focus();
        };

        // Hide autocomplete
        const hideAutocomplete = () => {
            if (autocompleteContainer) {
                autocompleteContainer.style.display = 'none';
            }
        };

        // Check if item exists in mappings
        const itemExists = (item) => {
            return Array.from(this.mappings.keys()).some(mappedItem => 
                mappedItem.toLowerCase() === item.toLowerCase()
            );
        };

        // Handle new item confirmation with category selection
        const confirmNewItem = async (item) => {
            return new Promise((resolve) => {
                const modal = document.createElement('div');
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0,0,0,0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10000;
                `;
                
                const modalContent = document.createElement('div');
                modalContent.style.cssText = `
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    max-width: 450px;
                    text-align: center;
                    box-shadow: 0 10px 25px rgba(0,0,0,0.3);
                `;

                // Get existing categories from mappings
                const existingCategories = [...new Set(Array.from(this.mappings.values()))];
                const allCategories = [...this.categories]; // Use categories from mappings file
                
                // Combine and sort categories
                const categories = [...new Set([...existingCategories, ...allCategories])].sort();
                
                let categoriesOptions = categories.map(cat => 
                    `<option value="${cat}"${cat === 'שונות' ? ' selected' : ''}>${cat}</option>`
                ).join('');
                
                modalContent.innerHTML = `
                    <h3 style="color: #1f4e79; margin-bottom: 15px;">פריט חדש</h3>
                    <p style="margin-bottom: 20px; color: #666;">הפריט "${item}" לא קיים במיפויים.</p>
                    <div style="margin-bottom: 25px; text-align: right;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #333;">בחר קטגוריה:</label>
                        <select id="categorySelect" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-family: inherit; font-size: 1rem;">
                            ${categoriesOptions}
                        </select>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center;">
                        <button id="confirmBtn" class="btn btn-primary">הוסף עם קטגוריה</button>
                        <button id="cancelBtn" class="btn btn-secondary">בטל</button>
                    </div>
                `;
                
                modal.appendChild(modalContent);
                document.body.appendChild(modal);
                
                const categorySelect = document.getElementById('categorySelect');
                
                document.getElementById('confirmBtn').addEventListener('click', () => {
                    const selectedCategory = categorySelect.value;
                    document.body.removeChild(modal);
                    resolve({ confirmed: true, category: selectedCategory });
                });
                
                document.getElementById('cancelBtn').addEventListener('click', () => {
                    document.body.removeChild(modal);
                    resolve({ confirmed: false, category: null });
                });
                
                // Close on outside click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        document.body.removeChild(modal);
                        resolve({ confirmed: false, category: null });
                    }
                });
            });
        };

        // Input event listener
        itemInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            isNewItemConfirmed = false;
            
            if (query.length < 1) {
                hideAutocomplete();
                return;
            }
            
            const matchingItems = getMatchingItems(query);
            showAutocomplete(matchingItems);
        });

        // Keydown event listener for navigation
        itemInput.addEventListener('keydown', (e) => {
            if (!autocompleteContainer || autocompleteContainer.style.display === 'none') {
                return;
            }
            
            const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    updateSelection();
                    break;
                    
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, -1);
                    updateSelection();
                    break;
                    
                case 'Enter':
                    e.preventDefault();
                    if (selectedIndex >= 0 && items[selectedIndex]) {
                        selectItem(items[selectedIndex].textContent);
                    }
                    break;
                    
                case 'Escape':
                    hideAutocomplete();
                    break;
            }
        });

        // Blur event - validate item
        itemInput.addEventListener('blur', async (e) => {
            // Small delay to allow click on autocomplete
            setTimeout(async () => {
                if (autocompleteContainer && autocompleteContainer.style.display !== 'none') {
                    return;
                }
                
                const item = e.target.value.trim();
                
                if (!item) {
                    isNewItemConfirmed = false;
                    return;
                }
                
                if (!itemExists(item) && !isNewItemConfirmed) {
                    const result = await confirmNewItem(item);
                    
                    if (result.confirmed) {
                        isNewItemConfirmed = true;
                        // Add to mappings with selected category
                        this.mappings.set(item, result.category);
                        this.saveData();
                        this.updateMappingTable();
                        this.showNotification(`הפריט "${item}" נוסף למיפויים בקטגוריה "${result.category}"`, 'success');
                    } else {
                        // Reset the input
                        itemInput.value = '';
                        itemInput.focus();
                        isNewItemConfirmed = false;
                    }
                }
                
                hideAutocomplete();
            }, 200);
        });

        // Hide autocomplete on outside click
        document.addEventListener('click', (e) => {
            if (!itemInput.contains(e.target) && !autocompleteContainer?.contains(e.target)) {
                hideAutocomplete();
            }
        });

        // Clean up on form hide
        const originalHideForm = this.hideTransactionForm.bind(this);
        this.hideTransactionForm = () => {
            hideAutocomplete();
            isNewItemConfirmed = false;
            originalHideForm();
        };
    }

    // Setup check payment functionality
    setupCheckPayment() {
        const checkBox = document.getElementById('isCheck');
        
        checkBox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.showCheckDetailsModal();
            } else {
                // Clear check data if unchecked
                delete this.currentCheckData;
            }
        });
    }

    // Show check details modal
    showCheckDetailsModal(existingData = null) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'check-modal';
            
            const checkNumber = existingData?.checkNumber || '';
            const payeeName = existingData?.payeeName || '';
            
            modal.innerHTML = `
                <div class="check-modal-content">
                    <h3>🏦 פרטי הצ'יק</h3>
                    <div class="check-form-group">
                        <label for="checkNumber">מספר הצ'יק *</label>
                        <input type="text" id="checkNumber" value="${checkNumber}" placeholder="הזן מספר צ'יק" required>
                    </div>
                    <div class="check-form-group">
                        <label for="payeeName">שם המוטב (למי התשלום) *</label>
                        <input type="text" id="payeeName" value="${payeeName}" placeholder="שם המוטב" required>
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
                        <button id="saveCheckBtn" class="btn btn-primary">שמור פרטי צ'יק</button>
                        <button id="cancelCheckBtn" class="btn btn-secondary">בטל</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const checkNumberInput = document.getElementById('checkNumber');
            const payeeNameInput = document.getElementById('payeeName');
            
            checkNumberInput.focus();
            
            document.getElementById('saveCheckBtn').addEventListener('click', () => {
                const checkNumber = checkNumberInput.value.trim();
                const payeeName = payeeNameInput.value.trim();
                
                if (!checkNumber || !payeeName) {
                    alert('אנא מלא את כל השדות החובה');
                    return;
                }
                
                this.currentCheckData = {
                    checkNumber: checkNumber,
                    payeeName: payeeName
                };
                
                document.body.removeChild(modal);
                resolve({ saved: true, data: this.currentCheckData });
            });
            
            document.getElementById('cancelCheckBtn').addEventListener('click', () => {
                document.getElementById('isCheck').checked = false;
                delete this.currentCheckData;
                document.body.removeChild(modal);
                resolve({ saved: false });
            });
            
            // Close on outside click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    document.getElementById('isCheck').checked = false;
                    delete this.currentCheckData;
                    document.body.removeChild(modal);
                    resolve({ saved: false });
                }
            });
        });
    }

    deleteTransaction(id) {
        if (confirm('האם אתה בטוח שברצונך למחוק את העסקה?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveData();
            this.updateTransactionsTable();
            this.updateDisplay();
            this.showNotification('העסקה נמחקה', 'info');
        }
    }

    editTransaction(id) {
        const transaction = this.transactions.find(t => t.id === id);
        if (transaction) {
            this.showTransactionForm(transaction);
        }
    }

    updateTransactionsTable() {
        const tbody = document.getElementById('transactionsBody');
        tbody.innerHTML = '';

        // Get selected month filter from data entry tab
        const selectedMonth = document.getElementById('dataEntryMonthSelect').value;

        // Filter transactions by current year - handle both old data (without year) and new data (with year)
        let currentYearTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear; // Use current year if no year specified
            return transactionYear === this.currentYear;
        });
        
        // Filter by month if a specific month is selected (not "all")
        if (selectedMonth && selectedMonth !== 'all') {
            const monthNumber = parseInt(selectedMonth);
            currentYearTransactions = currentYearTransactions.filter(t => t.month === monthNumber);
            console.log(`Filtered to ${currentYearTransactions.length} transactions for month ${selectedMonth}`);
        } else {
            console.log(`Showing all ${currentYearTransactions.length} transactions for year ${this.currentYear}`);
        }

        const sortedTransactions = [...currentYearTransactions].sort((a, b) => {
            // Sort alphabetically by item name (א-ב)
            return a.item.localeCompare(b.item, 'he');
        });

        sortedTransactions.forEach(transaction => {
            const row = document.createElement('tr');
            
            // Create check info cell
            let checkInfo = '';
            if (transaction.paymentMethod === 'check' && transaction.checkDetails) {
                checkInfo = `<span class="check-badge" title="צ'יק #${transaction.checkDetails.checkNumber} למוטב: ${transaction.checkDetails.payeeName}">צ'יק #${transaction.checkDetails.checkNumber}</span>`;
            }
            
            row.innerHTML = `
                <td>${this.getMonthName(transaction.month)}</td>
                <td>${transaction.item}</td>
                <td class="amount ${transaction.type}">${this.formatCurrency(transaction.amount)}</td>
                <td><span class="type-badge ${transaction.type}">${this.getTypeLabel(transaction.type)}</span></td>
                <td><span class="category-badge">${transaction.category}</span></td>
                <td>${transaction.note || ''}</td>
                <td>${checkInfo}</td>
                <td class="action-buttons">
                    <button onclick="budgetSystem.editTransaction(${transaction.id})" class="btn btn-secondary btn-small" title="ערוך">✏️</button>
                    <button onclick="budgetSystem.deleteTransaction(${transaction.id})" class="btn btn-danger btn-small" title="מחק">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Mapping management
    showMappingForm(editData = null) {
        document.getElementById('mappingForm').style.display = 'block';

        if (editData) {
            // Fill form with existing data for editing
            document.getElementById('mappingItem').value = editData.item;
            document.getElementById('mappingItem').readOnly = true; // Can't change item name, only category
            document.getElementById('mappingCategory').value = editData.category;
            document.getElementById('includeInMonthlyExpenses').checked = editData.includeInMonthlyExpenses !== false;

            // Change form title and button text
            document.querySelector('#mappingForm h3').textContent = 'עריכת מיפוי';
            document.querySelector('#newMappingForm button[type="submit"]').innerHTML = '💾 עדכן';

            // Store the original item for updating
            document.getElementById('newMappingForm').dataset.editItem = editData.item;
        } else {
            // New mapping mode
            document.getElementById('mappingItem').readOnly = false;
            document.querySelector('#mappingForm h3').textContent = 'מיפוי חדש';
            document.querySelector('#newMappingForm button[type="submit"]').innerHTML = '💾 שמור';
            delete document.getElementById('newMappingForm').dataset.editItem;
        }

        document.getElementById('mappingItem').focus();
    }

    hideMappingForm() {
        document.getElementById('mappingForm').style.display = 'none';
        document.getElementById('newMappingForm').reset();
        document.getElementById('mappingItem').readOnly = false;

        // Reset form to "new mapping" mode
        document.querySelector('#mappingForm h3').textContent = 'מיפוי חדש';
        document.querySelector('#newMappingForm button[type="submit"]').innerHTML = '💾 שמור';
        delete document.getElementById('newMappingForm').dataset.editItem;
    }

    addMapping() {
        const form = document.getElementById('newMappingForm');
        const isEditing = !!form.dataset.editItem;

        const item = document.getElementById('mappingItem').value.trim();
        const category = document.getElementById('mappingCategory').value;
        const includeInMonthlyExpenses = document.getElementById('includeInMonthlyExpenses').checked;

        if (!item || !category) {
            alert('אנא מלא את כל השדות');
            return;
        }

        if (isEditing) {
            // Update existing mapping
            const oldItem = form.dataset.editItem;

            // If item name hasn't changed (it shouldn't since it's readonly), just update category and flag
            this.mappings.set(oldItem, {
                category: category,
                includeInMonthlyExpenses: includeInMonthlyExpenses
            });

            this.saveData();
            this.updateMappingTable();
            this.updateTransactionsTable(); // Refresh transactions to show updated categories
            this.hideMappingForm();
            this.showNotification(`המיפוי עודכן בהצלחה: "${item}" → "${category}"`, 'success');
        } else {
            // Add new mapping
            if (this.mappings.has(item)) {
                if (!confirm(`המיפוי "${item}" כבר קיים. האם לעדכן אותו?`)) {
                    return;
                }
            }

            this.mappings.set(item, {
                category: category,
                includeInMonthlyExpenses: includeInMonthlyExpenses
            });
            this.saveData();
            this.updateMappingTable();
            this.updateTransactionsTable(); // Refresh transactions to show updated categories
            this.hideMappingForm();
            this.showNotification(`המיפוי נוסף בהצלחה: "${item}" → "${category}"`, 'success');
        }
    }

    editMapping(item, category, includeInMonthlyExpenses) {
        this.showMappingForm({ item, category, includeInMonthlyExpenses });
    }

    // Count how many transactions use a specific item
    countTransactionsUsingItem(item) {
        return this.transactions.filter(t => t.item === item).length;
    }

    deleteMapping(item) {
        // Check if item is being used in transactions
        const usageCount = this.countTransactionsUsingItem(item);

        if (usageCount > 0) {
            alert(`❌ לא ניתן למחוק את המיפוי "${item}"\n\nהפריט בשימוש ב-${usageCount} עסקאות.\nמחק תחילה את כל העסקאות המשתמשות בפריט זה.`);
            return;
        }

        if (confirm(`האם אתה בטוח שברצונך למחוק את המיפוי של "${item}"?`)) {
            this.mappings.delete(item);
            this.saveData();
            this.updateMappingTable();
            this.updateTransactionsTable(); // Refresh transactions
            this.showNotification('המיפוי נמחק', 'info');
        }
    }

    updateMappingTable() {
        const tbody = document.getElementById('mappingBody');
        tbody.innerHTML = '';

        // Convert mappings to array and sort by item name
        const sortedMappings = Array.from(this.mappings.entries()).sort((a, b) => a[0].localeCompare(b[0]));

        sortedMappings.forEach(([item, mapping]) => {
            const row = document.createElement('tr');

            // Count how many transactions use this item
            const usageCount = this.countTransactionsUsingItem(item);

            // Create usage indicator
            let usageIndicator = '';
            if (usageCount > 0) {
                usageIndicator = `<span class="usage-badge" title="${usageCount} עסקאות משתמשות בפריט זה">📊 ${usageCount}</span>`;
            } else {
                usageIndicator = `<span class="no-usage-badge" title="אין עסקאות משתמשות בפריט זה">⚪ 0</span>`;
            }

            // Create monthly expenses indicator
            const monthlyExpensesIndicator = mapping.includeInMonthlyExpenses
                ? '<span class="monthly-expense-badge yes" title="נכלל בטבלת הוצאות החודש">✅</span>'
                : '<span class="monthly-expense-badge no" title="לא נכלל בטבלת הוצאות החודש">❌</span>';

            row.innerHTML = `
                <td>${item}</td>
                <td><span class="category-badge">${mapping.category}</span></td>
                <td class="usage-cell">${usageIndicator}</td>
                <td class="monthly-expense-cell">${monthlyExpensesIndicator}</td>
                <td class="action-buttons">
                    <button onclick="budgetSystem.editMapping('${item}', '${mapping.category}', ${mapping.includeInMonthlyExpenses})" class="btn btn-secondary btn-small" title="ערוך">✏️</button>
                    <button onclick="budgetSystem.deleteMapping('${item}')" class="btn btn-danger btn-small" title="מחק">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    // Monthly view
    updateMonthlyView() {
        const selectedMonth = parseInt(document.getElementById('monthSelect').value);
        this.updateBalanceSummary(selectedMonth);
        this.updateCategorySummary(selectedMonth);
        this.updateActualExpensesSummary(selectedMonth);
        this.updateMonthlyTransactions(selectedMonth);
        this.updateCheckPaymentsSummary(selectedMonth);
    }

    // Update balance summary table
    updateBalanceSummary(month) {
        const container = document.getElementById('balanceSummary');
        // Filter transactions - handle both old data (without year) and new data (with year)
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear; // Use current year if no year specified
            return t.month === month && transactionYear === this.currentYear;
        });
        
        console.log(`Found ${monthlyTransactions.length} transactions for month ${month}, year ${this.currentYear}`);
        
        // Calculate totals
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const transfers = monthlyTransactions
            .filter(t => t.type === 'transfer')
            .reduce((sum, t) => sum + t.amount, 0);
        
        // Get opening balance for this month, auto-set from previous month if not set
        let openingBalance = this.openingBalances.get(`${this.currentYear}-${month}`);
        if (openingBalance === undefined && month !== 1) {
            // Auto-set from previous month
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? this.currentYear - 1 : this.currentYear;
            const autoBalance = this.calculateClosingBalance(prevMonth, prevYear);
            if (autoBalance !== 0) {
                openingBalance = autoBalance;
                this.openingBalances.set(`${this.currentYear}-${month}`, autoBalance);
                this.saveData();
            } else {
                openingBalance = 0;
            }
        } else if (openingBalance === undefined) {
            openingBalance = 0;
        }
        
        // Calculate closing balance with transfers
        const netChange = income - expenses + transfers;
        const closingBalance = openingBalance + netChange;
        
        // Get monthly notes
        const monthlyNotes = this.getMonthlyNotes(month) || '';
        
        container.innerHTML = `
            <div class="balance-row opening">
                <span class="balance-label">
                    <button class="settings-btn" onclick="budgetSystem.showOpeningBalanceModal(${month})" title="ערוך יתרת פתיחה">⚙️</button>
                    יתרת עו"ש תחילת חודש:
                </span>
                <span class="balance-amount opening">${this.formatCurrency(openingBalance)}</span>
            </div>
            <div class="balance-row">
                <span class="balance-label">סיכום הכנסות:</span>
                <span class="balance-amount positive">${this.formatCurrency(income)}</span>
            </div>
            <div class="balance-row">
                <span class="balance-label">סיכום הוצאות:</span>
                <span class="balance-amount negative">${this.formatCurrency(expenses)}</span>
            </div>
            ${transfers !== 0 ? `
            <div class="balance-row">
                <span class="balance-label">העברות:</span>
                <span class="balance-amount ${transfers >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(transfers)}</span>
            </div>` : ''}
            <div class="balance-row net-change">
                <span class="balance-label">שינוי נטו בחודש:</span>
                <span class="balance-amount ${netChange >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(netChange)}</span>
            </div>
            <div class="balance-row closing">
                <span class="balance-label">יתרת עו"ש סוף חודש:</span>
                <span class="balance-amount closing">${this.formatCurrency(closingBalance)}</span>
            </div>
            <div class="balance-notes">
                <div class="notes-header">
                    <span class="notes-label">הערות לחודש:</span>
                    <button class="settings-btn" onclick="budgetSystem.showMonthlyNotesModal(${month})" title="ערוך הערות">📝</button>
                </div>
                <div class="notes-content">
                    ${monthlyNotes || '<span style="color: #999; font-style: italic;">אין הערות</span>'}
                </div>
            </div>
        `;
    }

    // Show modal to edit opening balance
    showOpeningBalanceModal(month) {
        const monthName = this.getMonthName(month);
        
        // Auto-set balance from previous month if not manually set
        let currentBalance = this.openingBalances.get(`${this.currentYear}-${month}`);
        if (currentBalance === undefined && month !== 1) {
            // Auto-calculate from previous month
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? this.currentYear - 1 : this.currentYear;
            const autoBalance = this.calculateClosingBalance(prevMonth, prevYear);
            if (autoBalance !== 0) {
                currentBalance = autoBalance;
                this.openingBalances.set(`${this.currentYear}-${month}`, autoBalance);
                this.saveData();
            } else {
                currentBalance = 0;
            }
        } else if (currentBalance === undefined) {
            currentBalance = 0;
        }
        
        const showInfo = month !== 1; // Show info for all months except January
        
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="settings-content">
                <h3 style="color: #1f4e79; margin-bottom: 15px;">יתרת פתיחה - ${monthName}</h3>
                ${showInfo ? `
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; margin-bottom: 20px; border: 2px solid #4caf50;">
                        <p style="margin: 0 0 10px 0; font-weight: 500; color: #2e7d32;">ℹ️ מידע:</p>
                        <p style="margin: 0; font-size: 0.9rem; color: #333;">
                            יתרת הפתיחה מחושבת אוטומטית מיתרת הסגירה של ${this.getMonthName(month === 1 ? 12 : month - 1)}.
                            תוכל לערוך את הסכום אם נדרש.
                        </p>
                    </div>
                ` : ''}
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">יתרת עו"ש בתחילת ${monthName}:</label>
                    <input type="number" id="openingBalanceInput" step="0.01" value="${currentBalance}" 
                           style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem;">
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="saveBalanceBtn" class="btn btn-primary">שמור</button>
                    <button id="cancelBalanceBtn" class="btn btn-secondary">בטל</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('openingBalanceInput').focus();
        document.getElementById('openingBalanceInput').select();
        
        document.getElementById('saveBalanceBtn').addEventListener('click', () => {
            const newBalance = parseFloat(document.getElementById('openingBalanceInput').value) || 0;
            this.openingBalances.set(`${this.currentYear}-${month}`, newBalance);
            this.saveData();
            this.updateBalanceSummary(month);
            document.body.removeChild(modal);
            this.showNotification(`יתרת הפתיחה ל${monthName} ${this.currentYear} עודכנה`, 'success');
        });
        
        document.getElementById('cancelBalanceBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        // Save on Enter
        document.getElementById('openingBalanceInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('saveBalanceBtn').click();
            }
        });
    }

    // Show modal to edit monthly notes
    showMonthlyNotesModal(month) {
        const monthName = this.getMonthName(month);
        const currentNotes = this.getMonthlyNotes(month) || '';
        
        const modal = document.createElement('div');
        modal.className = 'settings-modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="settings-content" style="width: 500px; max-width: 90vw;">
                <h3 style="color: #1f4e79; margin-bottom: 15px;">הערות לחודש ${monthName}</h3>
                <div style="margin-bottom: 20px;">
                    <label style="display: block; margin-bottom: 8px; font-weight: 500;">הערות והוצאות מיוחדות:</label>
                    <textarea id="monthlyNotesInput" rows="4" placeholder="לדוגמה: בונוס שנתי, חופשה, תיקונים בבית..."
                              style="width: 100%; padding: 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 1rem; resize: vertical; font-family: inherit;">${currentNotes}</textarea>
                </div>
                <div style="display: flex; gap: 10px; justify-content: center;">
                    <button id="saveNotesBtn" class="btn btn-primary">שמור</button>
                    <button id="cancelNotesBtn" class="btn btn-secondary">בטל</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('monthlyNotesInput').focus();
        
        document.getElementById('saveNotesBtn').addEventListener('click', () => {
            const newNotes = document.getElementById('monthlyNotesInput').value.trim();
            this.setMonthlyNotes(month, newNotes);
            this.saveData();
            this.updateBalanceSummary(month);
            document.body.removeChild(modal);
            this.showNotification(`הערות ל${monthName} ${this.currentYear} עודכנו`, 'success');
        });
        
        document.getElementById('cancelNotesBtn').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    // Get monthly notes
    getMonthlyNotes(month) {
        if (!this.monthlyNotes) {
            this.monthlyNotes = new Map();
        }
        return this.monthlyNotes.get(`${this.currentYear}-${month}`);
    }

    // Set monthly notes
    setMonthlyNotes(month, notes) {
        if (!this.monthlyNotes) {
            this.monthlyNotes = new Map();
        }
        this.monthlyNotes.set(`${this.currentYear}-${month}`, notes);
    }

    // Calculate closing balance for a month
    calculateClosingBalance(month, year = this.currentYear) {
        const monthlyTransactions = this.transactions.filter(t => t.month === month && t.year === year);
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const openingBalance = this.openingBalances.get(`${year}-${month}`) || 0;
        
        return openingBalance + income - expenses;
    }

    updateCategorySummary(month) {
        const container = document.getElementById('categorySummary');
        // Filter transactions - handle both old data (without year) and new data (with year)
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear; // Use current year if no year specified
            return t.month === month && transactionYear === this.currentYear;
        });
        
        // Group by category
        const categoryTotals = {};
        monthlyTransactions.forEach(transaction => {
            const category = transaction.category || 'לא מקוטלג';
            categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
        });

        // Sort categories by amount (descending)
        const sortedCategories = Object.entries(categoryTotals)
            .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

        container.innerHTML = '';
        sortedCategories.forEach(([category, amount]) => {
            const item = document.createElement('div');
            item.className = 'category-item';
            item.innerHTML = `
                <span class="category-name">${category}</span>
                <span class="category-amount ${amount >= 0 ? 'income' : 'expense'}">${this.formatCurrency(amount)}</span>
            `;
            container.appendChild(item);
        });

        if (sortedCategories.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">אין נתונים לחודש זה</p>';
        }
    }

    // Update actual expenses summary (excluding checks and income)
    updateActualExpensesSummary(month) {
        const container = document.getElementById('actualExpensesSummary');
        const monthName = this.getMonthName(month);

        // Update the title with the month name
        document.getElementById('actualExpensesTitle').textContent = `💰 הוצאות ${monthName}`;

        // Filter transactions - handle both old data (without year) and new data (with year)
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return t.month === month && transactionYear === this.currentYear;
        });

        // Filter using the new includeInMonthlyExpenses property
        // Exclude check payments
        const actualExpenses = monthlyTransactions.filter(t => {
            // Exclude check payments
            if (t.paymentMethod === 'check') {
                return false;
            }
            // Include only if item is marked for monthly expenses
            return this.shouldIncludeInMonthlyExpenses(t.item);
        });

        // Group by item name for display
        const itemTotals = {};
        actualExpenses.forEach(transaction => {
            const item = transaction.item || 'לא מזוהה';
            itemTotals[item] = (itemTotals[item] || 0) + Math.abs(transaction.amount);
        });

        // Sort items by amount (descending)
        const sortedItems = Object.entries(itemTotals)
            .sort((a, b) => b[1] - a[1]);

        // Calculate total
        const totalExpenses = actualExpenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);

        container.innerHTML = '';

        // Add table
        const table = document.createElement('table');
        table.className = 'expenses-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>פריט</th>
                    <th>סכום</th>
                    <th>אחוז</th>
                </tr>
            </thead>
            <tbody>
                ${sortedItems.map(([item, amount]) => {
                    const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : 0;
                    return `
                        <tr>
                            <td>${item}</td>
                            <td class="amount-cell">₪${amount.toFixed(2)}</td>
                            <td class="percentage-cell">${percentage}%</td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
            <tfoot>
                <tr class="total-row">
                    <td><strong>סה"כ הוצאות בפועל:</strong></td>
                    <td class="amount-cell"><strong>₪${totalExpenses.toFixed(2)}</strong></td>
                    <td class="percentage-cell"><strong>100%</strong></td>
                </tr>
            </tfoot>
        `;

        container.appendChild(table);

        if (sortedItems.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">אין הוצאות בפועל לחודש זה</p>';
        }
    }

    updateMonthlyTransactions(month) {
        const container = document.getElementById('monthlyTransactions');
        // Filter transactions - handle both old data (without year) and new data (with year)
        const monthlyTransactions = this.transactions
            .filter(t => {
                const transactionYear = t.year || this.currentYear; // Use current year if no year specified
                return t.month === month && transactionYear === this.currentYear;
            })
            .sort((a, b) => b.id - a.id); // Sort by id (newest first)

        container.innerHTML = '';
        monthlyTransactions.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'transaction-item';
            item.innerHTML = `
                <span class="transaction-item-name">${transaction.item}</span>
                <span class="transaction-amount ${transaction.type}">${this.formatCurrency(transaction.amount)}</span>
                <span class="type-badge ${transaction.type}">${this.getTypeLabel(transaction.type)}</span>
            `;
            container.appendChild(item);
        });

        if (monthlyTransactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">אין עסקאות לחודש זה</p>';
        }
    }

    // Dashboard
    updateDashboard() {
        const selectedMonth = parseInt(document.getElementById('dashboardMonth').value);
        this.updateMonthlyKPIs(selectedMonth);
        this.updateAnnualKPIs();
        this.updateCategoryBreakdown(selectedMonth);
        this.updateAnnualSummaryTable();
    }

    updateMonthlyKPIs(month) {
        // Filter transactions for the specific month and year - handle both old and new data
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return t.month === month && transactionYear === this.currentYear;
        });
        
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const net = income - expenses;

        document.getElementById('monthlyExpenses').textContent = this.formatCurrency(expenses);
        document.getElementById('monthlyIncome').textContent = this.formatCurrency(income);
        document.getElementById('monthlyNet').textContent = this.formatCurrency(net);
        document.getElementById('monthlyNet').className = `kpi-value ${net >= 0 ? 'income' : 'expense'}`;
    }

    updateAnnualKPIs() {
        // Filter transactions for current year - handle both old and new data
        const yearTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return transactionYear === this.currentYear;
        });
        
        const expenses = yearTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const income = yearTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const net = income - expenses;

        document.getElementById('annualExpenses').textContent = this.formatCurrency(expenses);
        document.getElementById('annualIncome').textContent = this.formatCurrency(income);
        document.getElementById('annualNet').textContent = this.formatCurrency(net);
        document.getElementById('annualNet').className = `kpi-value ${net >= 0 ? 'income' : 'expense'}`;
    }

    updateCategoryBreakdown(month) {
        const container = document.getElementById('categoryBreakdown');
        // Filter transactions for the specific month and year - handle both old and new data
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return t.month === month && transactionYear === this.currentYear && t.type === 'expense';
        });
        
        if (monthlyTransactions.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666;">אין נתוני הוצאות לחודש זה</p>';
            return;
        }

        const totalExpenses = monthlyTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        // Group by category
        const categoryTotals = {};
        monthlyTransactions.forEach(transaction => {
            const category = transaction.category || 'לא מקוטלג';
            categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(transaction.amount);
        });

        // Sort and show top categories
        const sortedCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Show top 5 categories

        container.innerHTML = '';
        sortedCategories.forEach(([category, amount]) => {
            const percentage = (amount / totalExpenses) * 100;
            const item = document.createElement('div');
            item.className = 'breakdown-item';
            item.innerHTML = `
                <span>${category}</span>
                <span class="breakdown-percentage">${percentage.toFixed(1)}%</span>
            `;
            container.appendChild(item);
        });
    }

    // Utility functions
    formatCurrency(amount) {
        const formattedAmount = new Intl.NumberFormat('he-IL', {
            style: 'currency',
            currency: 'ILS'
        }).format(Math.abs(amount));
        
        return amount < 0 ? `(${formattedAmount})` : formattedAmount;
    }

    getTypeLabel(type) {
        const labels = {
            'income': 'הכנסה',
            'expense': 'הוצאה',
            'transfer': 'העברה'
        };
        return labels[type] || type;
    }

    getMonthName(monthNumber) {
        const months = {
            1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
            5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
            9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
        };
        return months[monthNumber] || monthNumber.toString();
    }

    // Data persistence
    saveData() {
        const data = {
            transactions: this.transactions,
            mappings: Array.from(this.mappings.entries()),
            incomeItems: Array.from(this.incomeItems),
            categories: this.categories,
            openingBalances: Array.from(this.openingBalances.entries()),
            monthlyNotes: this.monthlyNotes ? Array.from(this.monthlyNotes.entries()) : [],
            lastSelectedMonth: this.lastSelectedMonth,
            lastSelectedYear: this.lastSelectedYear
        };
        localStorage.setItem('budgetData', JSON.stringify(data));
    }

    loadData() {
        const savedData = localStorage.getItem('budgetData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.transactions = data.transactions || [];
                
                // Update old transactions without year to use current year
                let dataUpdated = false;
                this.transactions.forEach(transaction => {
                    if (!transaction.year) {
                        transaction.year = this.currentYear;
                        dataUpdated = true;
                    }
                });
                
                if (dataUpdated) {
                    console.log('Updated old transactions with current year');
                    // Save the updated data back to localStorage
                    setTimeout(() => this.saveData(), 100);
                }
                
                if (data.mappings) {
                    this.mappings = new Map();
                    // Convert old format to new format if needed
                    data.mappings.forEach(([item, value]) => {
                        if (typeof value === 'string') {
                            // Old format: convert to new object format
                            this.mappings.set(item, {
                                category: value,
                                includeInMonthlyExpenses: true // Default to true for old mappings
                            });
                            dataUpdated = true;
                        } else if (value && typeof value === 'object') {
                            // New format: use as is, but ensure includeInMonthlyExpenses exists
                            this.mappings.set(item, {
                                category: value.category || 'לא מקוטלג',
                                includeInMonthlyExpenses: value.includeInMonthlyExpenses !== false
                            });
                        } else {
                            // Fallback
                            this.mappings.set(item, {
                                category: 'לא מקוטלג',
                                includeInMonthlyExpenses: true
                            });
                        }
                    });
                }
                if (data.incomeItems) {
                    this.incomeItems = new Set(data.incomeItems);
                }
                if (data.categories) {
                    this.categories = data.categories;
                }
                if (data.openingBalances) {
                    this.openingBalances = new Map(data.openingBalances);
                }
                if (data.monthlyNotes) {
                    this.monthlyNotes = new Map(data.monthlyNotes);
                }
                if (data.lastSelectedMonth) {
                    this.lastSelectedMonth = data.lastSelectedMonth;
                }
                if (data.lastSelectedYear) {
                    this.lastSelectedYear = data.lastSelectedYear;
                }

                console.log(`Loaded ${this.transactions.length} transactions for year ${this.currentYear}`);
            } catch (error) {
                console.error('Error loading saved data:', error);
            }
        }
    }

    // Export/Import functionality
    exportData() {
        const data = {
            transactions: this.transactions,
            mappings: Array.from(this.mappings.entries()),
            incomeItems: Array.from(this.incomeItems),
            categories: this.categories,
            openingBalances: Array.from(this.openingBalances.entries()),
            monthlyNotes: this.monthlyNotes ? Array.from(this.monthlyNotes.entries()) : [],
            lastSelectedMonth: this.lastSelectedMonth,
            lastSelectedYear: this.lastSelectedYear,
            exportDate: new Date().toISOString(),
            version: '1.3'
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `budget-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('הנתונים יוצאו בהצלחה!', 'success');
    }

    // Export mappings to mappings.json format
    exportMappingsFile() {
        const mappingsData = {
            categories: this.categories,
            incomeItems: Array.from(this.incomeItems),
            mappings: Object.fromEntries(this.mappings)
        };
        
        const dataStr = JSON.stringify(mappingsData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = 'mappings.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showNotification('קובץ המיפויים יוצא בהצלחה!', 'success');
    }

    importData(file) {
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                
                if (confirm('האם אתה בטוח? פעולה זו תחליף את כל הנתונים הקיימים.')) {
                    this.transactions = data.transactions || [];
                    if (data.mappings) {
                        this.mappings = new Map(data.mappings);
                    }
                    if (data.incomeItems) {
                        this.incomeItems = new Set(data.incomeItems);
                    }
                    if (data.categories) {
                        this.categories = data.categories;
                    }
                    if (data.openingBalances) {
                        this.openingBalances = new Map(data.openingBalances);
                    }
                    if (data.monthlyNotes) {
                        this.monthlyNotes = new Map(data.monthlyNotes);
                    }
                    if (data.lastSelectedMonth) {
                        this.lastSelectedMonth = data.lastSelectedMonth;
                    }
                    if (data.lastSelectedYear) {
                        this.lastSelectedYear = data.lastSelectedYear;
                        this.currentYear = this.lastSelectedYear;
                        document.getElementById('yearSelect').value = this.currentYear;
                    }

                    this.saveData();
                    this.updateDisplay();
                    this.showNotification('הנתונים יובאו בהצלחה!', 'success');
                }
            } catch (error) {
                console.error('Error importing data:', error);
                alert('שגיאה בייבוא הנתונים. אנא בדוק את הקובץ ונסה שוב.');
            }
        };
        reader.readAsText(file);
    }

    // Export monthly report
    exportMonthlyReport(month) {
        const monthName = this.getMonthName(month);
        const monthlyTransactions = this.transactions.filter(t => t.month === month);
        
        // Calculate totals
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const transfers = monthlyTransactions
            .filter(t => t.type === 'transfer')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const openingBalance = this.openingBalances.get(month) || 0;
        const netChange = income - expenses + transfers;
        const closingBalance = openingBalance + netChange;
        const monthlyNotes = this.getMonthlyNotes(month) || '';
        
        // Group by category
        const categoryTotals = {};
        monthlyTransactions.forEach(transaction => {
            const category = transaction.category || 'לא מקוטלג';
            categoryTotals[category] = (categoryTotals[category] || 0) + transaction.amount;
        });
        
        // Generate HTML report
        const reportHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח חודשי - ${monthName}</title>
    <style>
        body {
            font-family: 'Segoe UI', 'Arial', sans-serif;
            direction: rtl;
            text-align: right;
            margin: 15px;
            background: #f8f9fa;
            color: #333;
        }
        .report-header {
            background: linear-gradient(135deg, #1f4e79 0%, #2e86ab 100%);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            text-align: center;
            margin-bottom: 15px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .report-header h1 {
            margin: 5px 0;
            font-size: 1.5rem;
        }
        .report-header h2 {
            margin: 5px 0;
            font-size: 1.2rem;
            font-weight: 500;
        }
        .report-header p {
            margin: 5px 0;
            font-size: 0.9rem;
            opacity: 0.9;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 15px;
        }
        .summary-card {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 2px solid #e0e6ed;
        }
        .summary-card h3 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 1.1rem;
        }
        .balance-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
        }
        .balance-table th, .balance-table td {
            padding: 8px 10px;
            text-align: right;
            border-bottom: 1px solid #ddd;
            font-size: 0.9rem;
        }
        .balance-table th {
            background: #f8f9fa;
            font-weight: 600;
        }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
        .opening { color: #1976d2; }
        .closing { color: #2e7d32; font-weight: 600; }
        .transactions-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        .transactions-table th, .transactions-table td {
            padding: 6px 8px;
            text-align: right;
            border: 1px solid #ddd;
            font-size: 0.85rem;
        }
        .transactions-table th {
            background: #1f4e79;
            color: white;
        }
        .transactions-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .notes-section {
            background: #fff3e0;
            padding: 12px 15px;
            border-radius: 6px;
            border: 2px solid #ff9800;
            margin: 15px 0;
        }
        .notes-section h3 {
            margin-top: 0;
            margin-bottom: 8px;
            font-size: 1rem;
        }
        @media print {
            body { 
                background: white;
                margin: 10px;
            }
            .report-header { 
                background: #1f4e79 !important;
                padding: 10px 15px !important;
                margin-bottom: 10px !important;
            }
            .report-header h1 {
                font-size: 1.3rem !important;
            }
            .report-header h2 {
                font-size: 1rem !important;
            }
            .summary-grid {
                gap: 10px !important;
                margin-bottom: 10px !important;
            }
            .summary-card {
                padding: 10px !important;
            }
            .print-buttons { display: none !important; }
            .page-break { page-break-before: always; }
        }
        .print-buttons {
            position: fixed;
            top: 20px;
            left: 20px;
            display: flex;
            gap: 10px;
            z-index: 1000;
        }
        .print-btn {
            background: #1f4e79;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
        }
        .print-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(0,0,0,0.4);
        }
        .close-btn {
            background: #f44336;
        }
        .save-btn {
            background: #4caf50;
        }
    </style>
</head>
<body>
    <div class="print-buttons">
        <button class="print-btn" onclick="window.print()">🖨️ הדפס דוח</button>
        <button class="print-btn save-btn" onclick="saveAsHTML()">💾 שמור כ-HTML</button>
        <button class="print-btn close-btn" onclick="window.close()">❌ סגור</button>
    </div>
    
    <script>
        function saveAsHTML() {
            // Clone the document and remove the buttons
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'דוח-חודשי-' + document.querySelector('.report-header h2').textContent.replace(/ /g, '-') + '.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    </script>
    
    <div class="report-header">
        <h1>דוח חודשי מפורט</h1>
        <h2>${monthName} ${new Date().getFullYear()}</h2>
        <p>נוצר בתאריך: ${new Date().toLocaleDateString('he-IL')}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>💳 סיכום יתרות ותזרים</h3>
            <table class="balance-table">
                <tr>
                    <th>פריט</th>
                    <th>סכום</th>
                </tr>
                <tr>
                    <td>יתרת עו"ש תחילת חודש</td>
                    <td class="opening">${this.formatCurrency(openingBalance)}</td>
                </tr>
                <tr>
                    <td>סיכום הכנסות</td>
                    <td class="positive">${this.formatCurrency(income)}</td>
                </tr>
                <tr>
                    <td>סיכום הוצאות</td>
                    <td class="negative">${this.formatCurrency(expenses)}</td>
                </tr>
                ${transfers !== 0 ? `
                <tr>
                    <td>העברות</td>
                    <td class="${transfers >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(transfers)}</td>
                </tr>` : ''}
                <tr>
                    <td>שינוי נטו בחודש</td>
                    <td class="${netChange >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(netChange)}</td>
                </tr>
                <tr>
                    <td><strong>יתרת עו"ש סוף חודש</strong></td>
                    <td class="closing">${this.formatCurrency(closingBalance)}</td>
                </tr>
            </table>
        </div>

        <div class="summary-card">
            <h3>📊 פילוח לפי קטגוריות</h3>
            <table class="balance-table">
                <tr>
                    <th>קטגוריה</th>
                    <th>סכום</th>
                </tr>
                ${Object.entries(categoryTotals)
                    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                    .map(([category, amount]) => `
                <tr>
                    <td>${category}</td>
                    <td class="${amount >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(amount)}</td>
                </tr>`).join('')}
            </table>
        </div>
    </div>

    ${monthlyNotes ? `
    <div class="notes-section">
        <h3>📝 הערות לחודש</h3>
        <p>${monthlyNotes.replace(/\n/g, '<br>')}</p>
    </div>` : ''}

    <div class="summary-card">
        <h3>📋 פירוט תנועות החודש</h3>
        <table class="transactions-table">
            <thead>
                <tr>
                    <th>פריט</th>
                    <th>סכום</th>
                    <th>סוג</th>
                    <th>קטגוריה</th>
                    <th>הערה</th>
                </tr>
            </thead>
            <tbody>
                ${monthlyTransactions
                    .sort((a, b) => b.id - a.id)
                    .map(t => `
                <tr>
                    <td>${t.item}</td>
                    <td class="${t.type}">${this.formatCurrency(t.amount)}</td>
                    <td>${this.getTypeLabel(t.type)}</td>
                    <td>${t.category}</td>
                    <td>${t.note || ''}</td>
                </tr>`).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;

        // Create and display the report in a new window
        const newWindow = window.open('', '_blank', 'width=1024,height=768,scrollbars=yes,resizable=yes');
        if (newWindow) {
            newWindow.document.write(reportHTML);
            newWindow.document.close();
            
            // Focus the new window
            newWindow.focus();
            
            // Add keyboard shortcuts for convenience
            newWindow.addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.key === 'p') {
                    e.preventDefault();
                    newWindow.print();
                }
                if (e.key === 'Escape') {
                    newWindow.close();
                }
            });
            
            this.showNotification(`דוח ${monthName} נפתח בחלון חדש - Ctrl+P להדפסה, לחץ על 💾 לשמירה כ-HTML, או Esc לסגירה`, 'success');
        } else {
            // Fallback if popup is blocked - create downloadable file
            const reportBlob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(reportBlob);
            link.download = `דוח-חודשי-${monthName}-${new Date().getFullYear()}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification(`החלון נחסם - הדוח נשמר כקובץ`, 'info');
        }
    }

    updateCheckPaymentsSummary(month) {
        const container = document.getElementById('checkPaymentsList');
        const summaryCard = document.getElementById('checkPaymentsSummary');
        
        // Filter check payments - handle both old data (without year) and new data (with year)
        const checkPayments = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear; // Use current year if no year specified
            return t.month === month && 
                   transactionYear === this.currentYear &&
                   t.paymentMethod === 'check' && 
                   t.checkDetails;
        });

        if (checkPayments.length === 0) {
            summaryCard.style.display = 'none';
            return;
        }

        summaryCard.style.display = 'block';
        container.innerHTML = '';
        
        checkPayments.forEach(transaction => {
            const item = document.createElement('div');
            item.className = 'check-payment-item';
            item.innerHTML = `
                <div class="check-payment-details">
                    <div class="check-payment-number">צ'יק מספר: ${transaction.checkDetails.checkNumber}</div>
                    <div class="check-payment-payee">מוטב: ${transaction.checkDetails.payeeName}</div>
                    <div style="margin-top: 5px;">
                        <strong>עבור:</strong> ${transaction.item}
                        ${transaction.note ? `<div class="check-payment-note">הערה: ${transaction.note}</div>` : ''}
                    </div>
                </div>
                <div class="check-payment-amount">${this.formatCurrency(transaction.amount)}</div>
            `;
            container.appendChild(item);
        });

        // Add total if more than one check
        if (checkPayments.length > 1) {
            const totalAmount = checkPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
            const totalItem = document.createElement('div');
            totalItem.style.cssText = `
                background: #f5f5f5;
                border: 2px solid #666;
                border-radius: 8px;
                padding: 10px 15px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-weight: 600;
                margin-top: 10px;
            `;
            totalItem.innerHTML = `
                <span>סה"כ תשלומי צ'יקים (${checkPayments.length} צ'יקים):</span>
                <span style="color: #d32f2f; font-size: 1.1rem;">${this.formatCurrency(totalAmount)}</span>
            `;
            container.appendChild(totalItem);
        }
    }

    // Update all displays
    updateDisplay() {
        this.updateTransactionsTable();
        this.updateMappingTable();
        
        if (this.currentTab === 'monthly') {
            this.updateMonthlyView();
        } else if (this.currentTab === 'dashboard') {
            this.updateDashboard();
        }
    }

    // Show notification
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            font-weight: 500;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    updateAnnualSummaryTable() {
        const container = document.getElementById('annualSummaryTable');
        
        // Define categories in specific order
        const categories = [
            'חינוך ותרבות',
            'טיפול רפואי', 
            'כלכלה',
            'מיסים',
            'נסיעות',
            'ביגוד',
            'משכורת + ביטוח לאומי',
            'עמלת בנק',
            'שונות'
        ];
        
        // Process data for all 12 months
        const monthlyData = {};
        const categoryTotals = {};
        
        // Initialize data structures
        for (let month = 1; month <= 12; month++) {
            monthlyData[month] = {};
            categories.forEach(cat => {
                monthlyData[month][cat] = 0;
            });
        }
        
        categories.forEach(cat => {
            categoryTotals[cat] = 0;
        });
        
        // Process transactions - include BOTH income and expenses
        this.transactions.forEach(transaction => {
            const month = transaction.month;
            let category = transaction.category || 'שונות';
            
            // Handle special income category mapping
            if (category === 'משכורת' || category === 'ביטוח לאומי' || category === 'מענק עבודה') {
                category = 'משכורת + ביטוח לאומי';
            }
            
            // For income transactions, use positive amount; for expenses, use absolute value
            const amount = transaction.type === 'income' ? transaction.amount : Math.abs(transaction.amount);
            
            if (categories.includes(category)) {
                monthlyData[month][category] += amount;
                categoryTotals[category] += amount;
            } else {
                monthlyData[month]['שונות'] += amount;
                categoryTotals['שונות'] += amount;
            }
        });
        
        // Calculate monthly totals (Income - Expenses)
        const monthlyTotals = {};
        for (let month = 1; month <= 12; month++) {
            const income = monthlyData[month]['משכורת + ביטוח לאומי'] || 0;
            const expenses = categories
                .filter(cat => cat !== 'משכורת + ביטוח לאומי')
                .reduce((sum, cat) => sum + monthlyData[month][cat], 0);
            monthlyTotals[month] = income - expenses;
        }
        
        // Build HTML table
        let tableHTML = `
            <table>
                <thead>
                    <tr>
                        <th style="width: 100px;">חודש</th>
                        ${categories.map(cat => `<th style="min-width: 80px;">${cat}</th>`).join('')}
                        <th style="min-width: 90px; background: #1976d2;">יתרה נטו</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        // Add rows for each month
        for (let month = 1; month <= 12; month++) {
            const monthName = this.getMonthName(month);
            tableHTML += `
                <tr>
                    <td class="month-name">${monthName}</td>
                    ${categories.map(cat => {
                        const amount = monthlyData[month][cat];
                        const isIncome = cat === 'משכורת + ביטוח לאומי';
                        return `<td class="category-amount ${amount === 0 ? 'zero' : ''} ${isIncome ? 'income-cell' : ''}">${
                            amount === 0 ? '-' : this.formatCurrency(amount)
                        }</td>`;
                    }).join('')}
                    <td class="total-monthly ${monthlyTotals[month] >= 0 ? 'positive' : 'negative'}">${
                        monthlyTotals[month] === 0 ? '-' : this.formatCurrency(monthlyTotals[month])
                    }</td>
                </tr>
            `;
        }
        
        // Add totals row - calculate totals first
        const incomeTotal = categoryTotals['משכורת + ביטוח לאומי'] || 0;
        const expenseCategories = categories.filter(cat => cat !== 'משכורת + ביטוח לאומי');
        const expenseTotal = expenseCategories.reduce((sum, cat) => sum + categoryTotals[cat], 0);
        const annualNet = incomeTotal - expenseTotal;
        
        tableHTML += `
                <tr class="total-row">
                    <td class="month-name">סה״כ שנתי</td>
                    ${categories.map(cat => {
                        const amount = categoryTotals[cat];
                        const isIncome = cat === 'משכורת + ביטוח לאומי';
                        return `<td class="category-total ${isIncome ? 'income-total' : ''}">${
                            amount === 0 ? '-' : this.formatCurrency(amount)
                        }</td>`;
                    }).join('')}
                    <td class="category-total ${annualNet >= 0 ? 'positive' : 'negative'}" style="background: ${annualNet >= 0 ? '#4caf50' : '#f44336'}; color: white;">
                        ${this.formatCurrency(annualNet)}
                    </td>
                </tr>
            </tbody>
        </table>
        `;
        
        container.innerHTML = tableHTML;
        
        // Add summary statistics using already calculated values
        const netAmount = annualNet; // Use the already calculated value
        
        // Add summary statistics
        const statsHTML = `
            <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: #2e7d32; margin-bottom: 5px;">סה״כ הכנסות שנתי</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: #1b5e20;">
                        ${this.formatCurrency(incomeTotal)}
                    </div>
                </div>
                <div style="background: #ffebee; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: #c62828; margin-bottom: 5px;">סה״כ הוצאות שנתי</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: #b71c1c;">
                        ${this.formatCurrency(expenseTotal)}
                    </div>
                </div>
                <div style="background: ${netAmount >= 0 ? '#e3f2fd' : '#fce4ec'}; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: ${netAmount >= 0 ? '#1565c0' : '#c2185b'}; margin-bottom: 5px;">יתרה שנתית נטו</div>
                    <div style="font-size: 1.2rem; font-weight: 600; color: ${netAmount >= 0 ? '#0d47a1' : '#880e4f'};">
                        ${this.formatCurrency(netAmount)}
                    </div>
                </div>
                <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: #e65100; margin-bottom: 5px;">ממוצע הוצאות חודשי</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #bf360c;">
                        ${this.formatCurrency(expenseTotal / 12)}
                    </div>
                </div>
                <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: #7b1fa2; margin-bottom: 5px;">קטגוריית הוצאה מובילה</div>
                    <div style="font-size: 0.9rem; font-weight: 600; color: #4a148c;">
                        ${expenseCategories.reduce((max, cat) => 
                            categoryTotals[cat] > max.amount ? {category: cat, amount: categoryTotals[cat]} : max, 
                            {category: '', amount: 0}
                        ).category || 'אין נתונים'}
                    </div>
                </div>
                <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.9rem; color: #2e7d32; margin-bottom: 5px;">ממוצע הכנסות חודשי</div>
                    <div style="font-size: 1rem; font-weight: 600; color: #1b5e20;">
                        ${this.formatCurrency(incomeTotal / 12)}
                    </div>
                </div>
            </div>
        `;
        
        container.innerHTML += statsHTML;
    }
}

// CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize the budget system when the page loads
let budgetSystem;
document.addEventListener('DOMContentLoaded', async () => {
    budgetSystem = new BudgetSystem();
});
