// Budget System - JavaScript Logic
class BudgetSystem {
    constructor() {
        this.transactions = [];
        this.importedCheckItems = []; // Store check items from imports that shouldn't be included in calculations
        this.mappings = new Map(); // item -> { category, includeInMonthlyExpenses }
        this.incomeItems = new Set();
        this.categories = [];
        this.openingBalances = new Map(); // Store opening balance per month per year
        this.manualOpeningBalances = new Set(); // Track which balances are manually set
        this.monthlyNotes = new Map(); // Store monthly notes per year
        this.currentMonth = new Date().getMonth() + 1;
        this.currentYear = new Date().getFullYear();
        this.currentTab = 'data-entry';
        this.lastSelectedMonth = null; // Remember last selected month for new transactions
        this.lastSelectedYear = null; // Remember last selected year
        this.lastSelectedColor = 'none'; // Remember last selected color for new transactions

        this.initialize();
    }

    // Initialize the system
    initialize() {
        // Wait a moment for external libraries to load
        setTimeout(() => {
            // Verify XLSX library is loaded for Excel import functionality
            if (typeof XLSX !== 'undefined') {
                console.log('✅ XLSX library loaded successfully, version:', XLSX.version || 'unknown');
            } else {
                console.warn('⚠️ XLSX library not loaded - Excel import will not work');
                console.log('Available window properties containing "xls":', 
                    Object.keys(window).filter(k => k.toLowerCase().includes('xls')));
            }
        }, 100);

        this.checkUserSetup(); // Check if user has entered their details
        this.initializeDefaultMappings();
        this.loadData();
        this.initializeYearSelector();
        this.initializeEventListeners();
        // Don't load color selections - start fresh each time
        this.setCurrentMonth();
        this.updateDisplay();
    }

    // Check user setup and show modal if needed
    checkUserSetup() {
        const userData = localStorage.getItem('budgetUserData');
        if (!userData) {
            // Show setup modal
            document.getElementById('userSetupModal').style.display = 'flex';
        }
        // Note: Title remains "מערכת תקציב גיא שומרי" - user details only appear in reports
    }

    // Get user data for reports
    getUserData() {
        const userData = localStorage.getItem('budgetUserData');
        if (userData) {
            return JSON.parse(userData);
        }
        return null;
    }

    // Save user data and close modal
    saveUserData(name, phone, id = '') {
        const userData = {
            name: name,
            phone: phone,
            id: id || '',
            setupDate: new Date().toISOString()
        };
        localStorage.setItem('budgetUserData', JSON.stringify(userData));
        document.getElementById('userSetupModal').style.display = 'none';
        this.showNotification(`ברוך הבא ${name}! המערכת מוכנה לשימוש`, 'success');
    }

    // Load report producer data to settings fields
    loadReportProducerData() {
        const userData = this.getUserData();
        if (userData) {
            document.getElementById('reportProducerName').value = userData.name || '';
            document.getElementById('reportProducerPhone').value = userData.phone || '';
            document.getElementById('reportProducerId').value = userData.id || '';
        }
    }

    // Update report producer details
    updateReportProducer() {
        const name = document.getElementById('reportProducerName').value.trim();
        const phone = document.getElementById('reportProducerPhone').value.trim();
        const id = document.getElementById('reportProducerId').value.trim();
        
        if (!name) {
            this.showNotification('יש להזין שם מלא', 'error');
            return;
        }
        
        if (phone && !/^\d{10}$/.test(phone)) {
            this.showNotification('מספר טלפון חייב להיות בן 10 ספרות', 'error');
            return;
        }
        
        if (id && !/^\d{9}$/.test(id)) {
            this.showNotification('תעודת זהות חייבת להיות בת 9 ספרות', 'error');
            return;
        }
        
        const userData = this.getUserData();
        const updatedData = {
            name: name,
            phone: phone,
            id: id || '',
            setupDate: userData ? userData.setupDate : new Date().toISOString()
        };
        
        localStorage.setItem('budgetUserData', JSON.stringify(updatedData));
        this.showNotification('הפרטים עודכנו בהצלחה', 'success');
    }

    // Initialize default category mappings (fallback)
    initializeDefaultMappings() {
        // Define categories
        this.categories = [
            'ביגוד',
            'ביטוח לאומי',
            'הוצאת ריכוז חודשית',
            'הפקדה לחסכון בבנק',
            'חינוך ותרבות',
            'טיפול רפואי',
            'כלכלה',
            'מיסים',
            'משכורת',
            'נסיעות',
            'עמלת בנק',
            'שונות'
        ];

        // Define income items
        this.incomeItems = new Set([
            'משכורת',
            'ביטוח לאומי',
            'ביטוח לאומי ג"',
            'ביטוח לאומי ג״',
            'ביטוח לאומי ג',
            'מענק עבודה',
            'משיכת פקדון',
            'משיכת פיקדון',
            'משיכה מפקדון',
            'משיכה מפיקדון',
            'פרעון פקדון',
            'פרעון פיקדון',
            'ריבית מפקדון',
            'ריבית מפיקדון',
            'ריבית פקדון',
            'ריבית פיקדון'
        ]);

        const defaultMappings = [
            ['משכורת', 'משכורת', false],
            ['ביטוח לאומי', 'ביטוח לאומי', false],
            ['ביטוח לאומי ג"', 'ביטוח לאומי', false],
            ['ביטוח לאומי ג״', 'ביטוח לאומי', false],
            ['ביטוח לאומי ג', 'ביטוח לאומי', false],
            ['מענק עבודה', 'משכורת', false],
            ['סופרסל', 'כלכלה', true],
            ['הראל בטוח', 'מיסים', false],
            ['מנורה', 'מיסים', false],
            ['פניקס', 'מיסים', false],
            ['מכבי', 'מיסים', false],
            ['כרטיסיה', 'נסיעות', true],
            ['מונית', 'נסיעות', true],
            ['רב קו', 'נסיעות', true],
            ['נסיעות', 'נסיעות', true],
            ['עמלת בנק', 'עמלת בנק', false],
            ['ע.מפעולות-ישיר', 'עמלת בנק', false],
            ['רופא', 'טיפול רפואי', true],
            ['בית מרקחת', 'טיפול רפואי', true],
            ['רופא שיניים', 'טיפול רפואי', true],
            ['ביגוד', 'ביגוד', true],
            ['תספורת', 'ביגוד', true],
            ['ספר', 'חינוך ותרבות', true],
            ['קורס', 'חינוך ותרבות', true],
            ['קולנוע', 'חינוך ותרבות', true],
            ['מוזיאון', 'חינוך ותרבות', true],
            ['טיול', 'חינוך ותרבות', true],
            ['מתנ"ס', 'חינוך ותרבות', true],
            ['פלאפון', 'מיסים', false],
            ['מיסים', 'מיסים', false],
            ['חשמל', 'מיסים', false],
            ['סלקום', 'מיסים', false],
            ['אינטרנט', 'מיסים', false],
            ['מי רמת גן', 'מיסים', false],
            ['תמי 4', 'מיסים', false],
            ['סופר גז', 'מיסים', false],
            ['ארנונה', 'מיסים', false],
            ['עיריה', 'מיסים', false],
            ['הפקדה לחסכון', 'הפקדה לחסכון בבנק', true],
            ['הפקדה לפיקדון', 'הפקדה לחסכון בבנק', true],
            ['הפקדה לפקדון', 'הפקדה לחסכון בבנק', true],
            ['הפקדה פיקדון', 'הפקדה לחסכון בבנק', true],
            ['הפקדה פקדון', 'הפקדה לחסכון בבנק', true],
            ['משיכת פיקדון', 'הפקדה לחסכון בבנק', true],
            ['משיכת פקדון', 'הפקדה לחסכון בבנק', true],
            ['משיכה מפיקדון', 'הפקדה לחסכון בבנק', true],
            ['משיכה מפקדון', 'הפקדה לחסכון בבנק', true],
            ['פרעון פיקדון', 'הפקדה לחסכון בבנק', true],
            ['פרעון פקדון', 'הפקדה לחסכון בבנק', true],
            ['ריבית מפיקדון', 'הפקדה לחסכון בבנק', true],
            ['ריבית מפקדון', 'הפקדה לחסכון בבנק', true],
            ['ריבית פיקדון', 'הפקדה לחסכון בבנק', true],
            ['ריבית פקדון', 'הפקדה לחסכון בבנק', true]
        ];

        defaultMappings.forEach(([item, category, includeInMonthlyExpenses]) => {
            this.mappings.set(item, {
                category: category,
                includeInMonthlyExpenses: includeInMonthlyExpenses
            });
        });
    }

    // Initialize year selector
    initializeYearSelector() {
        const yearSelect = document.getElementById('yearSelect');
        const actualCurrentYear = new Date().getFullYear();

        // If currentYear was already set from loadData, use it; otherwise use actual current year
        const selectedYear = this.currentYear;

        // Add years from 2023 to actual current year + 40
        for (let year = 2024; year <= actualCurrentYear + 51; year++) {
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
        // User setup form
        document.getElementById('userSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('userName').value.trim();
            const phone = document.getElementById('userPhone').value.trim();
            const id = document.getElementById('userId').value.trim();
            if (name) {
                this.saveUserData(name, phone, id);
            }
        });

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

        // Handle mutual exclusion between regular check and special check item
        document.getElementById('isCheck').addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('isSpecialCheckItem').checked = false;
            }
        });

        document.getElementById('isSpecialCheckItem').addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('isCheck').checked = false;
            }
        });

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
            // Reset color selections when changing month
            this.resetColorSelections();
            this.updateTransactionsTable();
        });

        // Export monthly report
        document.getElementById('exportMonthlyReportBtn').addEventListener('click', () => {
            const selectedMonth = parseInt(document.getElementById('monthSelect').value);
            this.exportMonthlyReport(selectedMonth);
        });

        document.getElementById('exportDashboardReportBtn').addEventListener('click', () => {
            const selectedMonth = parseInt(document.getElementById('dashboardMonth').value);
            this.exportDashboardReport(selectedMonth);
        });

        // Import CSV handler
        document.getElementById('importCsvBtn').addEventListener('click', () => {
            document.getElementById('importCsvFile').click();
        });

        document.getElementById('importCsvFile').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.importCSV(file);
                e.target.value = ''; // Reset file input
            }
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

        // Update report producer details
        document.getElementById('updateProducerBtn').addEventListener('click', () => {
            this.updateReportProducer();
        });

        // Color checkboxes for summary
        document.querySelectorAll('.color-check').forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.saveSelectedColors();
                this.updateTransactionsTable();
            });
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

        // Load user data when switching to settings tab
        if (tabId === 'settings') {
            this.loadReportProducerData();
        }

        this.currentTab = tabId;

        // Update display based on current tab
        setTimeout(() => {
            if (tabId === 'monthly') {
                this.updateMonthlyView();
            } else if (tabId === 'dashboard') {
                this.updateDashboard();
            } else if (tabId === 'settings') {
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
            
            // Special check item is not editable from regular transactions
            document.getElementById('isSpecialCheckItem').checked = false;

            // Store check details
            if (editData.checkDetails) {
                this.currentCheckData = editData.checkDetails;
            }
            
            // Show/hide check info
            this.updateCheckInfoDisplay();
            
            // Set color
            document.getElementById('transactionColor').value = editData.color || 'none';
            
            // Set transaction type radio button
            if (editData.type === 'income') {
                document.getElementById('typeIncome').checked = true;
            } else {
                document.getElementById('typeExpense').checked = true;
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
            document.getElementById('isSpecialCheckItem').checked = false;
            delete this.currentCheckData;
            this.updateCheckInfoDisplay();
            
            // Use last selected color
            document.getElementById('transactionColor').value = this.lastSelectedColor;
            
            // Set default transaction type to expense
            document.getElementById('typeExpense').checked = true;
            
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
        document.getElementById('isSpecialCheckItem').checked = false;
        document.getElementById('typeExpense').checked = true; // Reset to default type
        // Don't reset color - it will be set from lastSelectedColor when opening next time
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
            isCheck: document.getElementById('isCheck').checked,
            isSpecialCheckItem: document.getElementById('isSpecialCheckItem').checked,
            color: document.getElementById('transactionColor').value,
            type: document.querySelector('input[name="transactionType"]:checked').value
        };

        // Validate data
        if (!formData.month || !formData.item || isNaN(formData.amount)) {
            alert('אנא מלא את כל השדות החובה');
            return;
        }

        // Handle special check item (שיק)
        if (formData.isSpecialCheckItem) {
            // Create imported check item
            const monthName = this.getMonthName(formData.month);
            const checkItem = {
                id: Date.now() + Math.random(),
                item: formData.item,
                amount: -Math.abs(formData.amount), // Always negative for expense
                month: formData.month,
                year: this.currentYear,
                note: formData.note,
                checkNumber: '',
                payeeName: '',
                color: 'purple' // Special color for imported check items
            };

            this.importedCheckItems.push(checkItem);
            this.saveData();
            this.updateImportedCheckItemsSummary();
            this.hideTransactionForm();
            this.updateDisplay();
            this.showNotification('פריט שיק מיוחד (שיק) נוסף בהצלחה! 💜', 'success');
            return;
        }

        // Validate check data if needed
        if (formData.isCheck && !this.currentCheckData) {
            alert('אנא הזן את פרטי הצ\'יק');
            return;
        }


        // Use manually selected type
        const type = formData.type;

        // Check if the item name is exactly "שיק" (without parentheses)
        let finalNote = formData.note;
        if (formData.item === 'שיק') {
            // Add "צ'יק" note if not already present
            if (!finalNote.includes('צ\'יק')) {
                finalNote = finalNote ? `${finalNote} - צ'יק` : 'צ\'יק';
            }
            console.log(`Adding note "צ'יק" to manually added item: ${formData.item}`);
        }

        const transactionData = {
            month: formData.month,
            year: this.currentYear, // Add year to transaction
            item: formData.item,
            amount: type === 'expense' ? -Math.abs(formData.amount) : Math.abs(formData.amount),
            type: type,
            category: this.getCategoryForItem(formData.item),
            note: finalNote,
            paymentMethod: formData.isCheck ? 'check' : 'cash',
            checkDetails: formData.isCheck ? this.currentCheckData : null,
            color: formData.color === 'none' ? null : formData.color
        };

        if (isEditing) {
            // Update existing transaction
            const editId = parseFloat(form.dataset.editId);
            const transactionIndex = this.transactions.findIndex(t => t.id === editId);
            
            if (transactionIndex !== -1) {
                // Keep the original ID, update all fields including color
                this.transactions[transactionIndex] = {
                    id: editId, // Preserve original ID
                    ...transactionData
                };
                
                console.log('Transaction updated:', this.transactions[transactionIndex]);
                this.showNotification('העסקה עודכנה בהצלחה!', 'success');
            } else {
                console.error('Transaction not found for edit:', editId);
                alert('שגיאה: העסקה לא נמצאה');
                return;
            }
        } else {
            // Create new transaction with selected color
            const transaction = {
                id: Date.now() + Math.random(),
                ...transactionData
            };

            // Save the selected color for next transaction
            this.lastSelectedColor = formData.color;

            this.transactions.push(transaction);
            this.showNotification('העסקה נוספה בהצלחה!', 'success');
        }

        this.saveData();
        this.updateTransactionsTable();
        this.hideTransactionForm();
        this.updateDisplay();
        
        // Return focus to "Add Transaction" button after adding new transaction (not after edit)
        if (!isEditing) {
            // Use requestAnimationFrame to ensure DOM updates are complete
            requestAnimationFrame(() => {
                setTimeout(() => {
                    const addBtn = document.getElementById('addTransactionBtn');
                    if (addBtn) {
                        addBtn.focus();
                        console.log('Focus returned to Add Transaction button');
                    }
                }, 150);
            });
        }
    }

    getCategoryForItem(item) {
        // Normalize item name - remove quote characters
        const normalizedItem = item.trim().replace(/["״]/g, '');
        
        // Special handling for deposit-related items (פקדון/פיקדון)
        if (normalizedItem.includes('פקדון') || normalizedItem.includes('פיקדון')) {
            return 'הפקדה לחסכון בבנק';
        }
        
        // Special handling for "ביטוח לאומי" variants
        if (normalizedItem === 'ביטוח לאומי' || normalizedItem === 'ביטוח לאומי ג' || normalizedItem.startsWith('ביטוח לאומי ג')) {
            return 'ביטוח לאומי';
        }
        
        // Try exact match first
        if (this.mappings.has(normalizedItem)) {
            const mapping = this.mappings.get(normalizedItem);
            return mapping.category || 'לא מקוטלג';
        }

        // Try partial match
        for (const [mappedItem, mapping] of this.mappings) {
            if (normalizedItem.includes(mappedItem) || mappedItem.includes(normalizedItem)) {
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
        // Normalize item name
        const normalizedItem = item.trim().toLowerCase();
        
        // Special handling: משיכה/פרעון/ריבית מפקדון = הכנסה
        if (normalizedItem.includes('פקדון') || normalizedItem.includes('פיקדון')) {
            // משיכת פקדון, פרעון פקדון, ריבית מפקדון = הכנסה
            if (normalizedItem.includes('משיכ') || 
                normalizedItem.includes('פרעון') || 
                normalizedItem.includes('ריבית')) {
                return 'income';
            }
            // הפקדה לפקדון = הוצאה
            if (normalizedItem.includes('הפקד')) {
                return 'expense';
            }
        }
        
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

                // Get existing categories from mappings (extract category names from mapping objects)
                const existingCategories = [...new Set(
                    Array.from(this.mappings.values()).map(mapping =>
                        typeof mapping === 'object' ? mapping.category : mapping
                    )
                )];
                const allCategories = [...this.categories]; // Use categories from mappings file
                
                // Combine and sort categories alphabetically
                const categories = [...new Set([...existingCategories, ...allCategories])].sort((a, b) => {
                    return a.localeCompare(b, 'he');
                });

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
                        this.mappings.set(item, {
                            category: result.category,
                            includeInMonthlyExpenses: true
                        });
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
        
        checkBox.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // If editing and check data exists, show it; otherwise show empty modal
                const existingData = this.currentCheckData || null;
                await this.showCheckDetailsModal(existingData);
                this.updateCheckInfoDisplay();
            } else {
                // Clear check data if unchecked
                delete this.currentCheckData;
                this.updateCheckInfoDisplay();
            }
        });
    }
    
    // Update check info display in the form
    updateCheckInfoDisplay() {
        // Find or create the check info display element
        let checkInfoDiv = document.getElementById('checkInfoDisplay');
        const paymentMethodSection = document.querySelector('.payment-method-section');
        
        if (!checkInfoDiv && paymentMethodSection) {
            checkInfoDiv = document.createElement('div');
            checkInfoDiv.id = 'checkInfoDisplay';
            checkInfoDiv.style.marginTop = '10px';
            paymentMethodSection.appendChild(checkInfoDiv);
        }
        
        if (!checkInfoDiv) return;
        
        const isCheck = document.getElementById('isCheck')?.checked;
        
        if (isCheck && this.currentCheckData) {
            // Clean up N/A values
            const checkNum = this.currentCheckData.checkNumber && this.currentCheckData.checkNumber !== 'N/A'
                ? this.currentCheckData.checkNumber
                : '(לא הוזן)';
            const payee = this.currentCheckData.payeeName && this.currentCheckData.payeeName !== 'לא צוין'
                ? this.currentCheckData.payeeName
                : '(לא הוזן)';
            
            // Show check details with edit button
            checkInfoDiv.innerHTML = `
                <div style="background: #e3f2fd; padding: 12px; border-radius: 8px; border-right: 4px solid #2196f3;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <div style="font-weight: 500; margin-bottom: 5px;">📋 פרטי הצ'יק:</div>
                            <div style="font-size: 0.9rem; color: #555;">
                                מס' צ'יק: <strong>${checkNum}</strong><br>
                                מוטב: <strong>${payee}</strong>
                            </div>
                        </div>
                        <button type="button" id="editCheckDetailsBtn" class="btn btn-secondary btn-small" style="min-width: 80px;">✏️ ערוך</button>
                    </div>
                </div>
            `;
            
            // Add click event to edit button
            const editBtn = document.getElementById('editCheckDetailsBtn');
            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    await this.showCheckDetailsModal(this.currentCheckData);
                    this.updateCheckInfoDisplay();
                });
            }
        } else {
            checkInfoDiv.innerHTML = '';
        }
    }

    // Show check details modal
    showCheckDetailsModal(existingData = null) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'check-modal';
            
            // Clean up N/A values from old data
            const checkNumber = (existingData?.checkNumber && existingData.checkNumber !== 'N/A') ? existingData.checkNumber : '';
            const payeeName = (existingData?.payeeName && existingData.payeeName !== 'לא צוין') ? existingData.payeeName : '';
            
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
            
            // Apply row color if exists
            if (transaction.color) {
                row.style.background = this.getColorGradient(transaction.color);
                row.style.boxShadow = this.getColorShadow(transaction.color);
                row.style.borderLeft = this.getColorBorder(transaction.color);
                row.style.transition = 'all 0.3s ease';
            }
            
            // Create check info cell
            let checkInfo = '';
            if (transaction.paymentMethod === 'check' && transaction.checkDetails) {
                const checkNum = transaction.checkDetails.checkNumber && transaction.checkDetails.checkNumber !== 'N/A' 
                    ? transaction.checkDetails.checkNumber 
                    : '(לא הוזן)';
                const payee = transaction.checkDetails.payeeName && transaction.checkDetails.payeeName !== 'לא צוין'
                    ? transaction.checkDetails.payeeName
                    : '(לא הוזן)';
                checkInfo = `<span class="check-badge" title="צ'יק #${checkNum} למוטב: ${payee}">צ'יק #${checkNum}</span>`;
            }
            
            // Create color selector
            const colorCell = this.createColorSelector(transaction);
            
            row.innerHTML = `
                <td>${this.getMonthName(transaction.month)}</td>
                <td>${transaction.item}</td>
                <td class="amount ${transaction.type}">${this.formatCurrency(transaction.amount)}</td>
                <td><span class="type-badge ${transaction.type}">${this.getTypeLabel(transaction.type)}</span></td>
                <td><span class="category-badge">${transaction.category}</span></td>
                <td>${transaction.note || ''}</td>
                <td>${checkInfo}</td>
                <td class="color-selector-cell">${colorCell}</td>
                <td class="action-buttons">
                    <button onclick="budgetSystem.editTransaction(${transaction.id})" class="btn btn-secondary btn-small" title="ערוך">✏️</button>
                    <button onclick="budgetSystem.deleteTransaction(${transaction.id})" class="btn btn-danger btn-small" title="מחק">🗑️</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        // Update color summary
        this.updateColorSummary(currentYearTransactions);

        // Update imported check items summary
        this.updateImportedCheckItemsSummary();
    }
    
    // Get color code from color name
    getColorCode(colorName) {
        const colors = {
            'yellow': '#fff9c4',
            'green': '#c8e6c9',
            'blue': '#bbdefb',
            'pink': '#f8bbd0',
            'none': 'transparent'
        };
        return colors[colorName] || 'transparent';
    }
    
    // Get color gradient for table rows
    getColorGradient(colorName) {
        const gradients = {
            'yellow': 'linear-gradient(135deg, #fffde7 0%, #ffd54f 25%, #fff59d 50%, #fff9c4 75%, #fffde7 100%)',
            'green': 'linear-gradient(135deg, #e8f5e9 0%, #4caf50 25%, #81c784 50%, #a5d6a7 75%, #e8f5e9 100%)',
            'blue': 'linear-gradient(135deg, #e3f2fd 0%, #42a5f5 25%, #64b5f6 50%, #90caf9 75%, #e3f2fd 100%)',
            'pink': 'linear-gradient(135deg, #fce4ec 0%, #ec407a 25%, #f06292 50%, #f48fb1 75%, #fce4ec 100%)',
            'none': 'transparent'
        };
        return gradients[colorName] || 'transparent';
    }
    
    // Get color shadow for table rows
    getColorShadow(colorName) {
        const shadows = {
            'yellow': '0 2px 8px rgba(255, 213, 79, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            'green': '0 2px 8px rgba(76, 175, 80, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            'blue': '0 2px 8px rgba(66, 165, 245, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            'pink': '0 2px 8px rgba(236, 64, 122, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
            'none': 'none'
        };
        return shadows[colorName] || 'none';
    }
    
    // Get border color for table rows
    getColorBorder(colorName) {
        const borders = {
            'yellow': '3px solid #ffc107',
            'green': '3px solid #4caf50',
            'blue': '3px solid #2196f3',
            'pink': '3px solid #e91e63',
            'none': 'none'
        };
        return borders[colorName] || 'none';
    }
    
    // Create color selector HTML
    createColorSelector(transaction) {
        const colors = [
            { name: 'none', label: '—', color: '#f5f5f5' },
            { name: 'yellow', label: '●', color: '#ffd54f' },
            { name: 'green', label: '●', color: '#8ef393' },
            { name: 'blue', label: '●', color: '#64b5f6' },
            { name: 'pink', label: '●', color: '#f581e1' }
        ];
        
        return colors.map(c => {
            const isSelected = transaction.color === c.name;
            return `<span class="color-btn ${isSelected ? 'selected' : ''}" 
                         onclick="budgetSystem.changeTransactionColor(${transaction.id}, '${c.name}')"
                         style="background-color: ${c.color}; cursor: pointer; display: inline-block; width: 20px; height: 20px; border-radius: 3px; margin: 1px; border: ${isSelected ? '2px solid #333' : '1px solid #ccc'};"
                         title="${c.name === 'none' ? 'ללא צבע' : c.name}">
                    </span>`;
        }).join('');
    }
    
    // Change transaction color
    changeTransactionColor(transactionId, color) {
        const transaction = this.transactions.find(t => t.id === transactionId);
        if (transaction) {
            transaction.color = color === 'none' ? null : color;
            this.saveData();
            this.updateTransactionsTable();
        }
    }
    
    // Get selected colors from checkboxes
    getSelectedColors() {
        const checkboxes = document.querySelectorAll('.color-check');
        const selected = [];
        checkboxes.forEach(cb => {
            if (cb.checked) {
                selected.push(cb.value);
            }
        });
        return selected; // Return only selected colors, empty array if none
    }
    
    // Save selected colors to localStorage
    saveSelectedColors() {
        const selected = this.getSelectedColors();
        localStorage.setItem('selectedColors', JSON.stringify(selected));
    }
    
    // Load selected colors from localStorage
    loadSelectedColors() {
        const saved = localStorage.getItem('selectedColors');
        if (saved) {
            try {
                const selected = JSON.parse(saved);
                document.querySelectorAll('.color-check').forEach(cb => {
                    cb.checked = selected.includes(cb.value);
                });
            } catch (e) {
                console.error('Error loading selected colors:', e);
            }
        }
    }
    
    // Reset all color selections
    resetColorSelections() {
        document.querySelectorAll('.color-check').forEach(cb => {
            // Set default: green, blue, pink are checked; yellow is not
            cb.checked = (cb.value === 'green' || cb.value === 'blue' || cb.value === 'pink');
        });
        this.saveSelectedColors();
    }
    
    // Update color summary
    updateColorSummary(transactions) {
        const summaryDiv = document.getElementById('colorSummary');
        const summaryContent = document.getElementById('colorSummaryContent');
        
        if (!summaryDiv || !summaryContent) return;
        
        // Get selected colors from checkboxes
        const selectedColors = this.getSelectedColors();
        
        // Calculate totals and counts by color
        const colorTotals = {
            'yellow': 0,
            'green': 0,
            'blue': 0,
            'pink': 0
        };
        
        const colorCounts = {
            'yellow': 0,
            'green': 0,
            'blue': 0,
            'pink': 0
        };
        
        transactions.forEach(t => {
            if (t.color && colorTotals[t.color] !== undefined) {
                colorTotals[t.color] += t.amount;
                colorCounts[t.color]++;
            }
        });
        
        // Always show the summary div (so checkboxes are visible)
        summaryDiv.style.display = 'block';
        
        // Get selected month for later use
        const selectedMonth = document.getElementById('dataEntryMonthSelect')?.value;
        const hasSelectedMonth = selectedMonth && selectedMonth !== 'all';
        
        // If no colors are selected, show empty content
        if (selectedColors.length === 0) {
            summaryContent.innerHTML = '<p style="color: #999; font-style: italic;">בחר צבעים כדי לראות סיכום</p>';
            return;
        }
        
        const colorNames = {
            'yellow': '🟨 צהוב',
            'green': '🟩 ירוק',
            'blue': '🟦 כחול',
            'pink': '🟪 ורוד'
        };
        
        // Show all selected colors, even if they have 0 transactions
        let htmlContent = selectedColors.map(color => {
            const total = colorTotals[color] || 0;
            const count = colorCounts[color] || 0;
            
            return `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: white; border-radius: 5px; border-right: 4px solid ${this.getColorCode(color)};">
                    <span style="font-weight: 500;">${colorNames[color]} (${count}):</span>
                    <span style="font-size: 1.1rem; font-weight: 600; color: ${total >= 0 ? '#4caf50' : '#f44336'};">
                        ${this.formatCurrency(total)}
                    </span>
                </div>
            `;
        }).join('');
        
        // Add total summary of selected colors only
        const totalSelectedColors = Object.entries(colorTotals)
            .filter(([color, _]) => selectedColors.includes(color))
            .reduce((sum, [_, val]) => sum + val, 0);
        const totalSelectedCount = Object.entries(colorCounts)
            .filter(([color, _]) => selectedColors.includes(color))
            .reduce((sum, [_, val]) => sum + val, 0);
        
        // Always show total if colors are selected
        if (selectedColors.length > 0) {
            htmlContent += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #e3f2fd; border-radius: 5px; border-right: 4px solid #1976d2; margin-top: 8px; font-weight: 600;">
                    <span style="font-weight: 600;">סה"כ צבעים נבחרים (${totalSelectedCount}):</span>
                    <span style="font-size: 1.1rem; font-weight: 700; color: ${totalSelectedColors >= 0 ? '#2e7d32' : '#c62828'};">
                        ${this.formatCurrency(totalSelectedColors)}
                    </span>
                </div>
            `;
        }
        
        // Add closing balance if a specific month is selected
        if (hasSelectedMonth) {
            const monthNumber = parseInt(selectedMonth);
            const monthName = this.getMonthName(monthNumber);
            
            // Calculate previous month's closing balance
            const prevMonth = monthNumber === 1 ? 12 : monthNumber - 1;
            const prevYear = monthNumber === 1 ? this.currentYear - 1 : this.currentYear;
            const prevClosingBalance = this.calculateClosingBalance(prevMonth, prevYear);
            
            // Add colored items total to previous month's closing balance
            const balanceByColors = prevClosingBalance + totalSelectedColors;
            
            htmlContent += `
                <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #e3f2fd; border-radius: 5px; border-right: 4px solid #1976d2; margin-top: 8px; font-weight: 600;">
                    <span style="font-weight: 600;">יתרת עו"ש לחודש ${monthName} לפי סימון צבעים:</span>
                    <span style="font-size: 1.1rem; font-weight: 700; color: ${balanceByColors >= 0 ? '#1976d2' : '#f44336'};">
                        ${this.formatCurrency(balanceByColors)}
                    </span>
                </div>
            `;
        }
        
        summaryContent.innerHTML = htmlContent;
    }

    // Update imported check items summary
    updateImportedCheckItemsSummary() {
        const container = document.getElementById('importedCheckItemsList');
        const summaryCard = document.getElementById('importedCheckItemsSummary');

        if (!container || !summaryCard) return;

        // Get selected month filter from data entry tab
        const selectedMonth = document.getElementById('dataEntryMonthSelect')?.value;

        // Filter check items by current year and selected month
        let filteredCheckItems = this.importedCheckItems.filter(item => {
            const itemYear = item.year || this.currentYear;
            if (itemYear !== this.currentYear) return false;

            // Filter by month if specific month is selected
            if (selectedMonth && selectedMonth !== 'all') {
                return item.month === parseInt(selectedMonth);
            }
            return true;
        });

        if (filteredCheckItems.length === 0) {
            summaryCard.style.display = 'none';
            return;
        }

        summaryCard.style.display = 'block';

        // Update the title with month name
        const titleElement = summaryCard.querySelector('h3');
        if (titleElement && selectedMonth && selectedMonth !== 'all') {
            const monthName = this.getMonthName(parseInt(selectedMonth));
            titleElement.textContent = `🏦 פרטי צ׳יק הוצאות חודש ${monthName}`;
        } else {
            titleElement.textContent = '🏦 פרטי צ׳יק הוצאות';
        }

        container.innerHTML = '';

        filteredCheckItems.forEach(checkItem => {
            const checkNum = checkItem.checkNumber || '(לא הוזן)';
            const payee = checkItem.payeeName || '(לא הוזן)';

            const item = document.createElement('div');
            item.className = 'imported-check-item';
            item.innerHTML = `
                <div class="check-payment-details">
                    <div class="check-payment-number">צ'יק מספר: ${checkNum}</div>
                    <div class="check-payment-payee">מוטב: ${payee}</div>
                    <div style="margin-top: 5px;">
                        <strong>עבור:</strong> ${checkItem.item}
                        ${checkItem.note ? `<div class="check-payment-note">הערה: ${checkItem.note}</div>` : ''}
                    </div>
                    <div style="font-size: 0.85rem; color: #666; margin-top: 5px;">
                        ${this.getMonthName(checkItem.month)} ${checkItem.year}
                    </div>
                </div>
                <div class="check-payment-amount" style="padding-left: 20px;">${this.formatCurrency(checkItem.amount)}</div>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <button onclick="budgetSystem.editImportedCheckItem(${checkItem.id})" 
                            class="btn-edit" 
                            title="ערוך פרטי צ'יק"
                            style="padding: 5px 10px; background: #2196f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                        ✏️
                    </button>
                    <button onclick="budgetSystem.deleteImportedCheckItem(${checkItem.id})" 
                            class="btn-delete" 
                            title="מחק פריט שיק"
                            style="padding: 5px 10px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.9rem;">
                        🗑️
                    </button>
                </div>
            `;
            container.appendChild(item);
        });

        // Add total if more than one check item
        if (filteredCheckItems.length > 1) {
            const totalAmount = filteredCheckItems.reduce((sum, item) => sum + Math.abs(item.amount), 0);
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
                <span>סה"כ פריטי שיק (${filteredCheckItems.length} פריטים):</span>
                <span style="color: #d32f2f; font-size: 1.1rem;">${this.formatCurrency(totalAmount)}</span>
            `;
            container.appendChild(totalItem);
        }
    }

    // Delete imported check item
    deleteImportedCheckItem(itemId) {
        if (!confirm('האם למחוק את פריט השיק הזה?')) {
            return;
        }

        const index = this.importedCheckItems.findIndex(item => item.id === itemId);
        if (index !== -1) {
            this.importedCheckItems.splice(index, 1);
            this.saveData();
            this.updateImportedCheckItemsSummary();
            this.showNotification('פריט שיק נמחק בהצלחה', 'success');
        }
    }

    // Edit imported check item
    editImportedCheckItem(itemId) {
        const checkItem = this.importedCheckItems.find(item => item.id === itemId);
        if (!checkItem) return;

        // Create modal for editing
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        const form = document.createElement('div');
        form.style.cssText = `
            background: white;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            max-width: 500px;
            width: 90%;
        `;

        form.innerHTML = `
            <h3 style="margin: 0 0 20px 0; color: #1f4e79; text-align: right;">✏️ עריכת פרטי צ'יק</h3>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; text-align: right;">מספר צ'יק:</label>
                <input type="text" id="editCheckNumber" value="${checkItem.checkNumber || ''}" 
                       placeholder="הזן מספר צ'יק"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: right; font-size: 1rem;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; text-align: right;">שם המוטב:</label>
                <input type="text" id="editPayeeName" value="${checkItem.payeeName || ''}" 
                       placeholder="הזן שם מוטב"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: right; font-size: 1rem;">
            </div>

            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; text-align: right;">עבור:</label>
                <input type="text" id="editItemName" value="${checkItem.item}" 
                       placeholder="עבור מה הצ'יק"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: right; font-size: 1rem;">
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: 600; text-align: right;">הערה (אופציונלי):</label>
                <textarea id="editNote" 
                          placeholder="הוסף הערה"
                          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; text-align: right; font-size: 1rem; min-height: 60px;">${checkItem.note || ''}</textarea>
            </div>

            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancelEditBtn" 
                        style="padding: 10px 20px; background: #999; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">
                    ❌ ביטול
                </button>
                <button id="saveEditBtn" 
                        style="padding: 10px 20px; background: #4caf50; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 1rem;">
                    💾 שמור
                </button>
            </div>
        `;

        modal.appendChild(form);
        document.body.appendChild(modal);

        // Cancel button
        document.getElementById('cancelEditBtn').onclick = () => {
            document.body.removeChild(modal);
        };

        // Save button
        document.getElementById('saveEditBtn').onclick = () => {
            const checkNumber = document.getElementById('editCheckNumber').value.trim();
            const payeeName = document.getElementById('editPayeeName').value.trim();
            const itemName = document.getElementById('editItemName').value.trim();
            const note = document.getElementById('editNote').value.trim();

            if (!itemName) {
                alert('נא למלא את השדה "עבור"');
                return;
            }

            // Update the check item
            checkItem.checkNumber = checkNumber;
            checkItem.payeeName = payeeName;
            checkItem.item = itemName;
            checkItem.note = note;

            this.saveData();
            this.updateImportedCheckItemsSummary();
            document.body.removeChild(modal);
            this.showNotification('פרטי הצ\'יק עודכנו בהצלחה', 'success');
        };

        // Close on background click
        modal.onclick = (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        };
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

    // Count how many transactions use a specific item
    countTransactionsUsingItem(item) {
        return this.transactions.filter(t => t.item === item).length;
    }

    updateAnnualSummaryTable() {
        const container = document.getElementById('annualSummaryTable');
        if (!container) {
            console.error('Annual summary table container not found');
            return;
        }
        
        try {
            // Add temporary message to show function is being called
            container.innerHTML = '<p style="color: blue; padding: 20px; text-align: center;">טוען נתונים...</p>';
            
            // Filter by current year first
            const currentYearTransactions = this.transactions.filter(t => {
                const transactionYear = t.year || this.currentYear;
                return transactionYear === this.currentYear;
            });
            
            console.log(`Annual table: Processing ${currentYearTransactions.length} transactions for year ${this.currentYear}`);
            
            // If no transactions, show message and stop
            if (currentYearTransactions.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; background: #f5f5f5; border-radius: 8px; border: 2px dashed #ccc;">
                        <h3 style="color: #666; margin: 0 0 10px 0;">📊 אין עסקאות לשנה ${this.currentYear}</h3>
                        <p style="color: #999; margin: 0;">טען עסקאות או בחר שנה אחרת</p>
                    </div>
                `;
                console.log('No transactions for year', this.currentYear, '- stopping table generation');
                return;
            }
            
            // Collect ONLY expense categories (exclude income)
            const expCats = new Set();
            currentYearTransactions.forEach(transaction => {
                if (transaction.type === 'expense') {
                    const category = transaction.category || 'שונות';
                    expCats.add(category);
                }
            });
            
            // Convert to sorted array alphabetically
            const categories = Array.from(expCats).sort((a, b) => a.localeCompare(b, 'he'));
            
            console.log('Expense categories found:', categories);
            
            // Process data for all 12 months
            const monthlyData = {};
            const categoryTotals = {};
            let totalIncomeAnnual = 0;
            
            // Initialize data structures
            for (let month = 1; month <= 12; month++) {
                monthlyData[month] = {
                    income: 0,
                    expenses: {}
                };
                categories.forEach(cat => {
                    monthlyData[month].expenses[cat] = 0;
                });
            }
            
            // Initialize category totals
            categories.forEach(cat => {
                categoryTotals[cat] = 0;
            });
            
            // Populate data from transactions
            currentYearTransactions.forEach((transaction, idx) => {
                const month = parseInt(transaction.month);
                
                // Debug first few transactions
                if (idx < 3) {
                    console.log(`Transaction ${idx}:`, { 
                        item: transaction.item, 
                        month, 
                        type: transaction.type, 
                        amount: transaction.amount, 
                        category: transaction.category 
                    });
                }
                
                // Skip if month is invalid
                if (!month || isNaN(month) || month < 1 || month > 12) {
                    console.warn('Invalid month for transaction:', transaction);
                    return;
                }
                
                if (transaction.type === 'income') {
                    // Add to income
                    monthlyData[month].income += transaction.amount;
                    totalIncomeAnnual += transaction.amount;
                } else if (transaction.type === 'expense') {
                    // Add to expense category
                    const category = transaction.category || 'שונות';
                    const amount = Math.abs(transaction.amount);
                    monthlyData[month].expenses[category] += amount;
                    categoryTotals[category] += amount;
                }
            });
            
            console.log('Monthly data sample (month 1):', monthlyData[1]);
            console.log('Category totals:', categoryTotals);
            
            // Calculate monthly expense totals and balances
            const monthlyExpenseTotals = {};
            const monthlyBalances = {};
            for (let month = 1; month <= 12; month++) {
                const expenseSum = categories.reduce((sum, cat) => 
                    sum + (monthlyData[month].expenses[cat] || 0), 0);
                monthlyExpenseTotals[month] = expenseSum;
                monthlyBalances[month] = monthlyData[month].income - expenseSum;
            }
            
            // Calculate totals
            const totalExpensesAnnual = categories.reduce((sum, cat) => sum + categoryTotals[cat], 0);
            const annualBalance = totalIncomeAnnual - totalExpensesAnnual;
            
            // Calculate percentages for each category
            const categoryPercents = {};
            categories.forEach(cat => {
                categoryPercents[cat] = totalExpensesAnnual > 0 ? (categoryTotals[cat] / totalExpensesAnnual) * 100 : 0;
            });
            
            // Build HTML table with new structure
            let tableHTML = `
                <table>
                    <thead>
                        <tr>
                            <th style="width: 100px;">חודש</th>
                            <th style="min-width: 90px; background: #4caf50; color: white;">הכנסות</th>
                            ${categories.map(cat => `<th style="min-width: 80px;">${cat}</th>`).join('')}
                            <th style="min-width: 110px; background: #f44336; color: white;">סך הוצאות</th>
                            <th style="min-width: 90px; background: #1976d2; color: white;">מאזן</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            // Add rows for each month
            for (let month = 1; month <= 12; month++) {
                const monthName = this.getMonthName(month);
                const income = monthlyData[month].income;
                const expenses = monthlyExpenseTotals[month];
                const balance = monthlyBalances[month];
                
                tableHTML += `
                    <tr>
                        <td class="month-name">${monthName}</td>
                        <td class="category-amount ${income === 0 ? 'zero' : 'income-cell'}">${
                            income === 0 ? '-' : this.formatCurrency(income)
                        }</td>
                        ${categories.map(cat => {
                            const amount = monthlyData[month].expenses[cat] || 0;
                            return `<td class="category-amount ${amount === 0 ? 'zero' : 'expense-cell'}">${
                                amount === 0 ? '-' : this.formatCurrency(amount)
                            }</td>`;
                        }).join('')}
                        <td class="total-monthly negative">${
                            expenses === 0 ? '-' : this.formatCurrency(expenses)
                        }</td>
                        <td class="total-monthly ${balance >= 0 ? 'positive' : 'negative'}">${
                            balance === 0 ? '-' : this.formatCurrency(balance)
                        }</td>
                    </tr>
                `;
            }
            
            // Add totals row with percentages
            tableHTML += `
                    <tr class="total-row" style="background: #e3f2fd;">
                        <td class="month-name" style="font-weight: 700;">סיכום</td>
                        <td class="category-total income-cell" style="font-weight: 700;">
                            ${this.formatCurrency(totalIncomeAnnual)}
                        </td>
                        ${categories.map(cat => {
                            const amount = categoryTotals[cat] || 0;
                            const percent = categoryPercents[cat];
                            return `<td class="category-total expense-cell" style="font-weight: 700;">
                                <div>${this.formatCurrency(amount)}</div>
                                <div style="font-size: 0.75rem; color: #666;">(${percent.toFixed(1)}%)</div>
                            </td>`;
                        }).join('')}
                        <td class="category-total" style="background: #f44336; color: white; font-weight: 700;">
                            ${this.formatCurrency(totalExpensesAnnual)}
                        </td>
                        <td class="category-total ${annualBalance >= 0 ? 'positive' : 'negative'}" style="font-weight: 700;">
                            ${this.formatCurrency(annualBalance)}
                        </td>
                    </tr>
                </tbody>
            </table>
            `;
            
            console.log('Setting container innerHTML...');
            container.innerHTML = tableHTML;
            console.log('✅ Container innerHTML set successfully! Table should now be visible.');
            
            // Find top expense category
            const topExpenseData = categories
                .map(cat => ({ category: cat, amount: categoryTotals[cat] || 0 }))
                .sort((a, b) => b.amount - a.amount);
            const topExpenseCategory = topExpenseData.length > 0 ? topExpenseData[0].category : 'אין נתונים';
            
            // Add summary statistics
            const statsHTML = `
                <div style="margin-top: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: #2e7d32; margin-bottom: 5px;">סה״כ הכנסות שנתי</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #1b5e20;">
                            ${this.formatCurrency(totalIncomeAnnual)}
                        </div>
                    </div>
                    <div style="background: #ffebee; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: #c62828; margin-bottom: 5px;">סה״כ הוצאות שנתי</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: #b71c1c;">
                            ${this.formatCurrency(totalExpensesAnnual)}
                        </div>
                    </div>
                    <div style="background: ${annualBalance >= 0 ? '#e3f2fd' : '#fce4ec'}; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: ${annualBalance >= 0 ? '#1565c0' : '#c2185b'}; margin-bottom: 5px;">יתרה שנתית נטו</div>
                        <div style="font-size: 1.2rem; font-weight: 600; color: ${annualBalance >= 0 ? '#0d47a1' : '#880e4f'};">
                            ${this.formatCurrency(annualBalance)}
                        </div>
                    </div>
                    <div style="background: #fff3e0; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: #e65100; margin-bottom: 5px;">ממוצע הוצאות חודשי</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #bf360c;">
                            ${this.formatCurrency(totalExpensesAnnual / 12)}
                        </div>
                    </div>
                    <div style="background: #f3e5f5; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: #7b1fa2; margin-bottom: 5px;">קטגוריית הוצאה מובילה</div>
                        <div style="font-size: 0.9rem; font-weight: 600; color: #4a148c;">
                            ${topExpenseCategory}
                        </div>
                    </div>
                    <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
                        <div style="font-size: 0.9rem; color: #2e7d32; margin-bottom: 5px;">ממוצע הכנסות חודשי</div>
                        <div style="font-size: 1rem; font-weight: 600; color: #1b5e20;">
                            ${this.formatCurrency(totalIncomeAnnual / 12)}
                        </div>
                    </div>
                </div>
            `;
            
            console.log('Adding summary statistics...');
            container.innerHTML += statsHTML;
            console.log('✅ Annual summary table completed successfully! Check the dashboard.');
            
        } catch (error) {
            console.error('Error in updateAnnualSummaryTable:', error);
            container.innerHTML = `
                <div style="background: #ffebee; padding: 20px; border-radius: 8px; border: 2px solid #f44336;">
                    <h3 style="color: #d32f2f; margin: 0 0 10px 0;">❌ שגיאה בטעינת הטבלה</h3>
                    <p style="color: #666; margin: 0;">${error.message}</p>
                    <p style="color: #999; margin: 10px 0 0 0; font-size: 0.9em;">בדוק את הקונסול למידע נוסף</p>
                </div>
            `;
        }
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
        // Ensure monthNumber is an integer (handle both string and number)
        const month = parseInt(monthNumber);
        
        const months = {
            1: 'ינואר', 2: 'פברואר', 3: 'מרץ', 4: 'אפריל',
            5: 'מאי', 6: 'יוני', 7: 'יולי', 8: 'אוגוסט',
            9: 'ספטמבר', 10: 'אוקטובר', 11: 'נובמבר', 12: 'דצמבר'
        };
        return months[month] || monthNumber.toString();
    }

    // Data persistence
    saveData() {
        const data = {
            transactions: this.transactions,
            importedCheckItems: this.importedCheckItems, // Save imported check items
            mappings: Array.from(this.mappings.entries()),
            incomeItems: Array.from(this.incomeItems),
            categories: this.categories,
            openingBalances: Array.from(this.openingBalances.entries()),
            manualOpeningBalances: Array.from(this.manualOpeningBalances),
            monthlyNotes: this.monthlyNotes ? Array.from(this.monthlyNotes.entries()) : [],
            lastSelectedMonth: this.lastSelectedMonth,
            lastSelectedYear: this.lastSelectedYear,
            lastSelectedColor: this.lastSelectedColor
        };
        localStorage.setItem('budgetData', JSON.stringify(data));
        // Also save year separately as backup
        if (this.lastSelectedYear !== null && this.lastSelectedYear !== undefined) {
            localStorage.setItem('lastSelectedYear', this.lastSelectedYear.toString());
        }
        
        // Trigger Dropbox auto-sync if enabled
        if (window.dropboxSync) {
            window.dropboxSync.autoSync();
        }
    }

    loadData() {
        const savedData = localStorage.getItem('budgetData');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);

                // Load lastSelectedYear FIRST before using this.currentYear
                if (data.lastSelectedYear) {
                    this.lastSelectedYear = data.lastSelectedYear;
                    this.currentYear = this.lastSelectedYear;
                } else {
                    // Try loading from separate storage as backup
                    const savedYear = localStorage.getItem('lastSelectedYear');
                    if (savedYear) {
                        this.lastSelectedYear = parseInt(savedYear);
                        this.currentYear = this.lastSelectedYear;
                    }
                }

                // Load lastSelectedMonth
                if (data.lastSelectedMonth) {
                    this.lastSelectedMonth = data.lastSelectedMonth;
                }

                // Load lastSelectedColor
                if (data.lastSelectedColor) {
                    this.lastSelectedColor = data.lastSelectedColor;
                }

                this.transactions = data.transactions || [];
                this.importedCheckItems = data.importedCheckItems || []; // Load imported check items

                // Update old transactions - fix data types and add missing fields
                let dataUpdated = false;
                this.transactions.forEach(transaction => {
                    // Fix 1: Add year if missing
                    if (!transaction.year) {
                        transaction.year = this.currentYear;
                        dataUpdated = true;
                    }
                    
                    // Fix 2: Convert month from STRING to INTEGER if needed
                    if (typeof transaction.month === 'string') {
                        transaction.month = parseInt(transaction.month);
                        dataUpdated = true;
                        console.log(`Fixed month type for transaction: ${transaction.item} - month changed from string to ${transaction.month}`);
                    }
                    
                    // Fix 3: Update categories for items that now have proper mappings
                    // Also remove quote characters from item names
                    const itemName = transaction.item.trim();
                    const itemNameClean = itemName.replace(/["״]/g, '');
                    
                    // Remove quotes from item if present
                    if (itemName !== itemNameClean) {
                        transaction.item = itemNameClean;
                        dataUpdated = true;
                    }
                    
                    // Fix category for ביטוח לאומי variants - ALWAYS update
                    if (itemNameClean === 'ביטוח לאומי' || itemNameClean === 'ביטוח לאומי ג' || itemNameClean.startsWith('ביטוח לאומי ג')) {
                        if (transaction.category !== 'ביטוח לאומי') {
                            transaction.category = 'ביטוח לאומי';
                            dataUpdated = true;
                        }
                    }
                });
                
                if (dataUpdated) {
                    console.log('✅ Updated old transactions (year, month type, and category fixes)');
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
                    
                    // Merge new default mappings that don't exist yet
                    const defaultMappings = [
                        ['משכורת', 'משכורת', false],
                        ['ביטוח לאומי', 'ביטוח לאומי', false],
                        ['ביטוח לאומי ג"', 'ביטוח לאומי', false],
                        ['ביטוח לאומי ג״', 'ביטוח לאומי', false],
                        ['ביטוח לאומי ג', 'ביטוח לאומי', false],
                        ['מענק עבודה', 'משכורת', false],
                        ['סופרסל', 'כלכלה', true],
                        ['הראל בטוח', 'מיסים', false],
                        ['מנורה', 'מיסים', false],
                        ['פניקס', 'מיסים', false],
                        ['מכבי', 'מיסים', false],
                        ['כרטיסיה', 'נסיעות', true],
                        ['מונית', 'נסיעות', true],
                        ['רב קו', 'נסיעות', true],
                        ['נסיעות', 'נסיעות', true],
                        ['עמלת בנק', 'עמלת בנק', false],
                        ['ע.מפעולות-ישיר', 'עמלת בנק', false],
                        ['רופא', 'טיפול רפואי', true],
                        ['בית מרקחת', 'טיפול רפואי', true],
                        ['רופא שיניים', 'טיפול רפואי', true],
                        ['ביגוד', 'ביגוד', true],
                        ['תספורת', 'ביגוד', true],
                        ['ספר', 'חינוך ותרבות', true],
                        ['קורס', 'חינוך ותרבות', true],
                        ['קולנוע', 'חינוך ותרבות', true],
                        ['מוזיאון', 'חינוך ותרבות', true],
                        ['טיול', 'חינוך ותרבות', true],
                        ['מתנ"ס', 'חינוך ותרבות', true],
                        ['פלאפון', 'מיסים', false],
                        ['מיסים', 'מיסים', false],
                        ['חשמל', 'מיסים', false],
                        ['סלקום', 'מיסים', false],
                        ['אינטרנט', 'מיסים', false],
                        ['מי רמת גן', 'מיסים', false],
                        ['תמי 4', 'מיסים', false],
                        ['סופר גז', 'מיסים', false],
                        ['ארנונה', 'מיסים', false],
                        ['עיריה', 'מיסים', false]
                    ];
                    
                    // Add new mappings that don't exist
                    defaultMappings.forEach(([item, category, includeInMonthlyExpenses]) => {
                        if (!this.mappings.has(item)) {
                            this.mappings.set(item, {
                                category: category,
                                includeInMonthlyExpenses: includeInMonthlyExpenses
                            });
                            dataUpdated = true;
                            console.log(`Added new mapping: ${item} → ${category}`);
                        }
                    });
                } else {
                    // No saved mappings, initialize from defaults
                    this.initializeDefaultMappings();
                }
                if (data.incomeItems) {
                    this.incomeItems = new Set(data.incomeItems);
                    // Make sure all default income items exist
                    const defaultIncomeItems = [
                        'משכורת',
                        'ביטוח לאומי',
                        'ביטוח לאומי ג"',
                        'ביטוח לאומי ג״',
                        'ביטוח לאומי ג',
                        'מענק עבודה'
                    ];
                    defaultIncomeItems.forEach(item => {
                        if (!this.incomeItems.has(item)) {
                            this.incomeItems.add(item);
                            dataUpdated = true;
                        }
                    });
                } else {
                    this.incomeItems = new Set([
                        'משכורת',
                        'ביטוח לאומי',
                        'ביטוח לאומי ג"',
                        'ביטוח לאומי ג״',
                        'ביטוח לאומי ג',
                        'מענק עבודה'
                    ]);
                }
                if (data.categories) {
                    this.categories = data.categories;
                    // Make sure all default categories exist
                    const defaultCategories = [
                        'ביגוד',
                        'ביטוח לאומי',
                        'הוצאת ריכוז חודשית',
                        'חינוך ותרבות',
                        'טיפול רפואי',
                        'כלכלה',
                        'מיסים',
                        'משכורת',
                        'נסיעות',
                        'עמלת בנק',
                        'שונות'
                    ];
                    defaultCategories.forEach(cat => {
                        if (!this.categories.includes(cat)) {
                            this.categories.push(cat);
                            dataUpdated = true;
                        }
                    });
                } else {
                    this.categories = [
                        'ביגוד',
                        'ביטוח לאומי',
                        'הוצאת ריכוז חודשית',
                        'הפקדה לחסכון בבנק',
                        'חינוך ותרבות',
                        'טיפול רפואי',
                        'כלכלה',
                        'מיסים',
                        'משכורת',
                        'נסיעות',
                        'עמלת בנק',
                        'שונות'
                    ];
                }
                if (data.openingBalances) {
                    this.openingBalances = new Map(data.openingBalances);
                }
                if (data.manualOpeningBalances) {
                    this.manualOpeningBalances = new Set(data.manualOpeningBalances);
                }
                if (data.monthlyNotes) {
                    this.monthlyNotes = new Map(data.monthlyNotes);
                }

                console.log(`Loaded ${this.transactions.length} transactions for year ${this.currentYear}`);
                
                // Fix transaction types for deposit-related items
                let typesFixed = 0;
                this.transactions.forEach(transaction => {
                    const itemLower = transaction.item.toLowerCase();
                    // Check if this is a deposit withdrawal/redemption/interest that should be income
                    if ((itemLower.includes('פקדון') || itemLower.includes('פיקדון')) &&
                        (itemLower.includes('משיכ') || itemLower.includes('פרעון') || itemLower.includes('ריבית'))) {
                        if (transaction.type !== 'income') {
                            transaction.type = 'income';
                            // Ensure amount is positive for income
                            if (transaction.amount < 0) {
                                transaction.amount = Math.abs(transaction.amount);
                            }
                            typesFixed++;
                        }
                    }
                    // Check if this is a deposit placement that should be expense
                    else if ((itemLower.includes('פקדון') || itemLower.includes('פיקדון')) &&
                             itemLower.includes('הפקד')) {
                        if (transaction.type !== 'expense') {
                            transaction.type = 'expense';
                            // Ensure amount is negative for expense
                            if (transaction.amount > 0) {
                                transaction.amount = -Math.abs(transaction.amount);
                            }
                            typesFixed++;
                        }
                    }
                });
                
                if (typesFixed > 0) {
                    console.log(`✅ Fixed ${typesFixed} transaction types for deposit items`);
                    dataUpdated = true;
                }
                
                // Save if data was updated with new defaults
                if (dataUpdated) {
                    console.log('✅ Added new default mappings/categories');
                    setTimeout(() => this.saveData(), 100);
                }
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

    // Ensure XLSX library is loaded before use
    async ensureXLSXLoaded() {
        return new Promise((resolve, reject) => {
            if (typeof XLSX !== 'undefined') {
                console.log('✅ XLSX already loaded');
                resolve();
                return;
            }

            console.log('📥 Loading XLSX library...');
            
            // Use the global loadXLSXLibrary function if available
            if (typeof window.loadXLSXLibrary === 'function') {
                window.loadXLSXLibrary()
                    .then(() => resolve())
                    .catch(() => reject(new Error('Failed to load XLSX library')));
            } else {
                reject(new Error('XLSX loading function not available'));
            }
        });
    }

    // Load XLSX library dynamically (alternative method)
    loadXLSXLibrary() {
        return this.ensureXLSXLoaded();
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
    console.log('🚀 Initializing Budget System...');
    budgetSystem = new BudgetSystem();
    window.budgetSystem = budgetSystem; // Make it globally accessible
    console.log('✅ Budget System initialized and available globally');
    
    // Fix categories for existing transactions - run after initialization
    setTimeout(() => {
        console.log('🔍 בודק עסקאות לתיקון...');
        let fixed = 0;
        let quotesRemoved = 0;
        
        budgetSystem.transactions.forEach(transaction => {
            const itemName = transaction.item.trim();
            const itemNameClean = itemName.replace(/["\u05f4]/g, '');
            
            // Remove quotes from item name
            if (itemName !== itemNameClean) {
                transaction.item = itemNameClean;
                quotesRemoved++;
            }
            
            // Fix category for ביטוח לאומי variants - ALWAYS update
            if (itemNameClean === 'ביטוח לאומי' || itemNameClean === 'ביטוח לאומי ג' || itemNameClean.startsWith('ביטוח לאומי ג')) {
                if (transaction.category !== 'ביטוח לאומי') {
                    transaction.category = 'ביטוח לאומי';
                    fixed++;
                }
            }
        });
        
        if (fixed > 0 || quotesRemoved > 0) {
            console.log(`✅ הסרת גרשיים: ${quotesRemoved} | תיקון קטגוריות: ${fixed}`);
            budgetSystem.saveData();
            budgetSystem.updateDisplay();
            
            let msg = [];
            if (quotesRemoved > 0) msg.push(`${quotesRemoved} פריטים עודכנו (הוסרו גרשיים)`);
            if (fixed > 0) msg.push(`${fixed} קטגוריות תוקנו`);
            alert(`✅ ${msg.join('\n')}`);
        } else {
            console.log('ℹ️ לא נמצאו עסקאות לתיקון');
        }
    }, 1000);
});
