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
        this.loadSelectedColors(); // Load color selection from localStorage
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
        return selected.length > 0 ? selected : ['yellow', 'green', 'blue', 'pink']; // Default all if none selected
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
        
        // Always show summary when in data entry view
        summaryDiv.style.display = 'block';
        
        // Get selected month for later use
        const selectedMonth = document.getElementById('dataEntryMonthSelect')?.value;
        const hasSelectedMonth = selectedMonth && selectedMonth !== 'all';
        
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

    // Monthly view
    updateMonthlyView() {
        const selectedMonth = parseInt(document.getElementById('monthSelect').value);
        this.updateBalanceSummary(selectedMonth);
        this.updateCategorySummary(selectedMonth);
        this.updateActualExpensesSummary(selectedMonth);
        this.updateMonthlyTransactions(selectedMonth);
        this.updateCheckPaymentsSummary(selectedMonth);
        this.updateImportedCheckItemsMonthly(selectedMonth);
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
        
        // Get opening balance for this month, auto-set from previous month if not manually set
        const key = `${this.currentYear}-${month}`;
        let openingBalance = this.openingBalances.get(key);
        if ((openingBalance === undefined || !this.manualOpeningBalances.has(key)) && month !== 1) {
            // Auto-set from previous month (unless manually overridden)
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? this.currentYear - 1 : this.currentYear;
            const autoBalance = this.calculateClosingBalance(prevMonth, prevYear);
            if (autoBalance !== 0) {
                openingBalance = autoBalance;
                this.openingBalances.set(key, autoBalance);
                // Don't add to manualOpeningBalances - this is automatic
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
        
        // Get current balance or calculate from previous month
        const key = `${this.currentYear}-${month}`;
        let currentBalance = this.openingBalances.get(key);
        if (currentBalance === undefined && month !== 1) {
            // Calculate from previous month but don't save yet
            const prevMonth = month === 1 ? 12 : month - 1;
            const prevYear = month === 1 ? this.currentYear - 1 : this.currentYear;
            const autoBalance = this.calculateClosingBalance(prevMonth, prevYear);
            currentBalance = autoBalance !== 0 ? autoBalance : 0;
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
            const key = `${this.currentYear}-${month}`;
            this.openingBalances.set(key, newBalance);
            this.manualOpeningBalances.add(key); // Mark as manually set
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
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || year;
            return t.month === month && transactionYear === year;
        });
        const income = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        const expenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const transfers = monthlyTransactions
            .filter(t => t.type === 'transfer')
            .reduce((sum, t) => sum + t.amount, 0);
        const openingBalance = this.openingBalances.get(`${year}-${month}`) || 0;
        
        return openingBalance + income - expenses + transfers;
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

    // Check if a transaction is a duplicate
    isDuplicateTransaction(newTransaction) {
        return this.transactions.some(existing => {
            return existing.item === newTransaction.item &&
                   existing.month === newTransaction.month &&
                   existing.year === newTransaction.year &&
                   existing.type === newTransaction.type &&
                   Math.abs(existing.amount - newTransaction.amount) < 0.01; // Allow for floating point precision
        });
    }

    // Check if a check item is a duplicate
    isDuplicateCheckItem(newCheckItem) {
        return this.importedCheckItems.some(existing => {
            return existing.item === newCheckItem.item &&
                   existing.month === newCheckItem.month &&
                   existing.year === newCheckItem.year &&
                   Math.abs(existing.amount - newCheckItem.amount) < 0.01; // Allow for floating point precision
        });
    }

    // Import CSV or XLSX file
    importCSV(file) {
        if (!file) return;

        const fileExtension = file.name.split('.').pop().toLowerCase();

        if (fileExtension === 'xlsx' || fileExtension === 'xls') {
            // Check if XLSX library is available before processing
            if (typeof XLSX === 'undefined') {
                // Try to load XLSX library using global function
                if (typeof window.loadXLSXLibrary === 'function') {
                    console.log('⏳ טוען ספריית XLSX...');
                    window.loadXLSXLibrary().then(() => {
                        console.log('✅ XLSX נטען, מתחיל עיבוד קובץ');
                        this.processExcelFile(file);
                    }).catch(() => {
                        alert('שגיאה: לא ניתן לטעון את ספריית XLSX.\n\nפתרונות:\n1. רענן את הדף ונסה שוב\n2. בדוק חיבור אינטרנט\n3. השתמש בקובץ CSV במקום XLSX');
                    });
                } else {
                    alert('שגיאה: פונקציית טעינת XLSX לא זמינה.\nרענן את הדף ונסה שוב.');
                }
                return;
            }
            
            // XLSX library is already loaded
            this.processExcelFile(file);
        } else {
            // Process CSV file (original flow)
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const csvContent = e.target.result;
                    const result = this.parseAndValidateCSV(csvContent);
                
                if (!result.success) {
                    alert('שגיאה בטעינת הקובץ:\n' + result.error);
                    return;
                }

                // Add transactions
                let addedCount = 0;
                let skippedCount = 0;
                let checkItemsCount = 0;
                const importedMonth = result.transactions.length > 0 ? result.transactions[0].month : null;
                
                result.transactions.forEach(trans => {
                    // Check for duplicates before adding
                    if (this.isDuplicateTransaction(trans)) {
                        skippedCount++;
                        console.log(`Skipping duplicate transaction: ${trans.item} - ${trans.amount}`);
                    } else {
                        this.transactions.push(trans);
                        addedCount++;
                    }
                });

                // Add check items separately with duplicate checking
                if (result.checkItems && result.checkItems.length > 0) {
                    let skippedCheckItems = 0;
                    result.checkItems.forEach(checkItem => {
                        // Check for duplicates before adding
                        if (this.isDuplicateCheckItem(checkItem)) {
                            skippedCheckItems++;
                            console.log(`Skipping duplicate check item: ${checkItem.item} - ${checkItem.amount}`);
                        } else {
                            this.importedCheckItems.push(checkItem);
                            checkItemsCount++;
                        }
                    });
                    
                    if (skippedCheckItems > 0) {
                        console.log(`⚠️ ${skippedCheckItems} פריטי שיק כפולים דולגו`);
                    }
                }

                this.saveData();
                
                // Show detailed notification
                let message = `✅ ${addedCount} עסקאות נוספו בהצלחה`;
                if (checkItemsCount > 0) {
                    message += `\n🏦 ${checkItemsCount} פריטי שיק נוספו`;
                }
                if (skippedCount > 0) {
                    message += `\n⚠️ ${skippedCount} עסקאות כפולות דולגו`;
                }
                // Add info about skipped check items
                if (result.checkItems && result.checkItems.length > 0) {
                    const totalCheckItemsAttempted = result.checkItems.length;
                    const skippedCheckItems = totalCheckItemsAttempted - checkItemsCount;
                    if (skippedCheckItems > 0) {
                        message += `\n⚠️ ${skippedCheckItems} פריטי שיק כפולים דולגו`;
                    }
                }
                this.showNotification(message, addedCount > 0 ? 'success' : 'info');
                
                // Update displays (wrapped separately to avoid blocking success message)
                try {
                    this.updateDisplay();
                    
                    // Update dashboard month selector to match imported month
                    if (importedMonth) {
                        const dashboardMonthSelect = document.getElementById('dashboardMonth');
                        if (dashboardMonthSelect) {
                            dashboardMonthSelect.value = importedMonth.toString().padStart(2, '0');
                        }
                    }
                    
                    // Force update dashboard even if not currently active tab
                    this.updateDashboard();
                } catch (displayError) {
                    console.error('Error updating displays:', displayError);
                    // Don't show error to user since data was imported successfully
                }
            } catch (error) {
                console.error('Error importing CSV:', error);
                    alert('שגיאה בקריאת הקובץ:\n' + error.message + '\n\nאנא ודא שהקובץ הוא CSV תקין.');
                }
            };
            reader.readAsText(file, 'UTF-8');
        }
    }

    // Process Excel file and convert to CSV format
    processExcelFile(file) {
        // Check if XLSX library is available
        if (typeof XLSX === 'undefined') {
            // Try to load XLSX library dynamically
            this.loadXLSXLibrary().then(() => {
                this.processExcelFile(file); // Retry after loading
            }).catch(() => {
                alert('שגיאה: ספריית XLSX לא נטענה.\n\nפתרונות אפשריים:\n1. רענן את הדף ונסה שוב\n2. בדוק חיבור לאינטרנט\n3. נסה דפדפן אחר\n4. השתמש בקובץ CSV במקום XLSX');
            });
            return;
        }

        console.log('✅ XLSX library loaded successfully, processing file:', file.name);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Get first sheet
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convert to array of arrays
                const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
                
                console.log('📊 Excel file data:', {
                    totalRows: rawData.length,
                    firstRows: rawData.slice(0, 5)
                });

                // Find header row (contains 'תאריך' and 'הפעולה')
                let headerRowIndex = -1;
                for (let i = 0; i < rawData.length; i++) {
                    const row = rawData[i];
                    const rowStr = row.join('|');
                    console.log(`Row ${i}:`, rowStr);
                    if (rowStr.includes('תאריך') && rowStr.includes('הפעולה')) {
                        headerRowIndex = i;
                        console.log(`✅ Found header row at index ${i}`);
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    console.error('❌ Header row not found. First 10 rows:', rawData.slice(0, 10));
                    alert('שגיאה: לא נמצאה שורת כותרות בקובץ.\nצפוי מבנה עם עמודות: תאריך, הפעולה\n\nבדוק את ה-Console לפרטים נוספים (F12)');
                    return;
                }
                
                const headers = rawData[headerRowIndex];
                const dataRows = rawData.slice(headerRowIndex + 1);
                
                console.log('📋 Headers found:', headers);

                // Map column indices
                const colMap = {};
                headers.forEach((header, idx) => {
                    const h = String(header).trim();
                    colMap[h] = idx;
                });
                
                console.log('🗺️ Column map:', colMap);

                // Columns to keep
                const dateCol = colMap['תאריך'];
                const actionCol = colMap['הפעולה'];
                const debitCol = colMap['חובה'] !== undefined ? colMap['חובה'] : colMap['חיוב'];
                const creditCol = colMap['זכות'];
                
                console.log('📊 Column indices:', { dateCol, actionCol, debitCol, creditCol });

                if (dateCol === undefined || actionCol === undefined) {
                    console.error('❌ Required columns not found. Available columns:', Object.keys(colMap));
                    alert('שגיאה: חסרות עמודות חובה בקובץ (תאריך, הפעולה)\n\nעמודות זמינות: ' + Object.keys(colMap).join(', ') + '\n\nבדוק את ה-Console לפרטים נוספים (F12)');
                    return;
                }
                
                // Process rows
                const monthMap = {
                    '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
                    '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
                    '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
                };
                
                const processedRows = [];
                const monthCounts = {};
                
                console.log(`🔄 Processing ${dataRows.length} data rows...`);

                dataRows.forEach((row, index) => {
                    if (!row || row.length === 0) return;
                    
                    let dateValue = row[dateCol];
                    const action = String(row[actionCol] || '').trim();
                    const debit = row[debitCol];
                    const credit = row[creditCol];
                    
                    if (!action) return; // Skip empty rows
                    
                    // Clean action from quotes and Hebrew geresh/gershayim
                    const cleanAction = action.replace(/["\u0022\u05F4\u05F3]/g, '');
                    
                    // Parse date
                    let dateStr = '';
                    if (typeof dateValue === 'number') {
                        // Excel date number
                        const excelDate = XLSX.SSF.parse_date_code(dateValue);
                        dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, '0')}-${String(excelDate.d).padStart(2, '0')}`;
                        if (index < 3) console.log(`Date conversion (row ${index}): ${dateValue} -> ${dateStr}`);
                    } else if (typeof dateValue === 'string') {
                        dateStr = dateValue.replace(' 00:00:00', '').trim();
                        if (index < 3) console.log(`Date string (row ${index}): ${dateValue} -> ${dateStr}`);
                    } else {
                        if (index < 3) console.log(`Unknown date type (row ${index}):`, typeof dateValue, dateValue);
                    }
                    
                    if (!dateStr || dateStr.length < 10) {
                        if (index < 3) console.warn(`Invalid date format (row ${index}): "${dateStr}"`);
                        return;
                    }

                    // Extract year and month
                    const year = dateStr.substring(0, 4);
                    const monthNum = dateStr.substring(5, 7);
                    const monthName = monthMap[monthNum];
                    
                    if (!monthName) return;
                    
                    // Count months
                    monthCounts[monthName] = (monthCounts[monthName] || 0) + 1;
                    
                    processedRows.push({
                        year,
                        month: monthName,
                        item: cleanAction,
                        debit: debit || '',
                        credit: credit || ''
                    });
                });
                
                console.log(`✅ Processed ${processedRows.length} rows`);
                console.log('📊 Month counts:', monthCounts);

                // Find most frequent month
                let mostFrequentMonth = null;
                let maxCount = 0;
                for (const [month, count] of Object.entries(monthCounts)) {
                    if (count > maxCount) {
                        maxCount = count;
                        mostFrequentMonth = month;
                    }
                }
                
                console.log(`📅 Most frequent month: ${mostFrequentMonth} (${maxCount} items)`);

                // Keep only rows from most frequent month
                const filteredRows = processedRows.filter(row => row.month === mostFrequentMonth);
                
                console.log(`✅ Filtered to ${filteredRows.length} rows for ${mostFrequentMonth}`);

                if (filteredRows.length === 0) {
                    console.error('❌ No valid data found after filtering');
                    alert('שגיאה: לא נמצאו נתונים תקינים בקובץ\n\nבדוק את ה-Console לפרטים נוספים (F12)');
                    return;
                }
                
                // Get year for filename
                const yearForFile = filteredRows[0].year;
                
                // Create CSV content
                let csvContent = 'שנה,חודש,פריט,חובה,זכות\n';
                filteredRows.forEach(row => {
                    csvContent += `${row.year},${row.month},${row.item},${row.debit},${row.credit}\n`;
                });
                
                // Create a virtual CSV file name
                const monthNumMap = {
                    'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04',
                    'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
                    'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12'
                };
                const monthForFile = monthNumMap[mostFrequentMonth];
                const numItems = filteredRows.length;
                const csvFileName = `${monthForFile}_${yearForFile}_${numItems}-items_csv.csv`;
                
                // Save CSV file to Downloads folder
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const link = document.createElement('a');
                const url = URL.createObjectURL(blob);
                link.setAttribute('href', url);
                link.setAttribute('download', csvFileName);
                link.style.visibility = 'hidden';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                
                // Show file saved notification with location
                this.showNotification(
                    `💾 קובץ CSV נשמר בהצלחה!\n\n` +
                    `📁 מיקום: תיקיית Downloads\n` +
                    `📄 קובץ: ${csvFileName}\n` +
                    `📊 ${mostFrequentMonth} ${yearForFile}\n` +
                    `✅ ${filteredRows.length} עסקאות`,
                    'success'
                );
                
                // Now parse the CSV content using existing logic
                const result = this.parseAndValidateCSV(csvContent);
                
                if (!result.success) {
                    alert('שגיאה בעיבוד הקובץ:\n' + result.error);
                    return;
                }
                
                // Add transactions
                let addedCount = 0;
                let skippedCount = 0;
                let checkItemsCount = 0;
                const importedMonth = result.transactions.length > 0 ? result.transactions[0].month : null;
                
                result.transactions.forEach(trans => {
                    if (this.isDuplicateTransaction(trans)) {
                        skippedCount++;
                    } else {
                        this.transactions.push(trans);
                        addedCount++;
                    }
                });
                
                // Add check items separately with duplicate checking
                if (result.checkItems && result.checkItems.length > 0) {
                    let skippedCheckItems = 0;
                    result.checkItems.forEach(checkItem => {
                        // Check for duplicates before adding
                        if (this.isDuplicateCheckItem(checkItem)) {
                            skippedCheckItems++;
                            console.log(`Skipping duplicate check item: ${checkItem.item} - ${checkItem.amount}`);
                        } else {
                            this.importedCheckItems.push(checkItem);
                            checkItemsCount++;
                        }
                    });
                    
                    if (skippedCheckItems > 0) {
                        console.log(`⚠️ ${skippedCheckItems} פריטי שיק כפולים דולגו`);
                    }
                }

                this.saveData();
                
                let message = `✅ ${addedCount} עסקאות נוספו מקובץ Excel`;
                if (checkItemsCount > 0) {
                    message += `\n🏦 ${checkItemsCount} פריטי שיק נוספו`;
                }
                if (skippedCount > 0) {
                    message += `\n⚠️ ${skippedCount} עסקאות כפולות דולגו`;
                }
                // Add info about skipped check items
                if (result.checkItems && result.checkItems.length > 0) {
                    const totalCheckItemsAttempted = result.checkItems.length;
                    const skippedCheckItems = totalCheckItemsAttempted - checkItemsCount;
                    if (skippedCheckItems > 0) {
                        message += `\n⚠️ ${skippedCheckItems} פריטי שיק כפולים דולגו`;
                    }
                }
                this.showNotification(message, addedCount > 0 ? 'success' : 'info');
                
                // Update displays
                try {
                    this.updateDisplay();
                    if (importedMonth) {
                        const dashboardMonthSelect = document.getElementById('dashboardMonth');
                        if (dashboardMonthSelect) {
                            dashboardMonthSelect.value = importedMonth.toString().padStart(2, '0');
                        }
                    }
                    this.updateDashboard();
                } catch (displayError) {
                    console.error('Error updating displays:', displayError);
                }
                
            } catch (error) {
                console.error('Error processing Excel file:', error);
                alert('שגיאה בקריאת קובץ Excel:\n' + error.message);
            }
        };

        reader.onerror = (error) => {
            console.error('FileReader error:', error);
            alert('שגיאה בקריאת הקובץ.\nאנא ודא שהקובץ תקין ונסה שוב.');
        };

        reader.readAsArrayBuffer(file);
    }

    // Parse and validate CSV content
    parseAndValidateCSV(csvContent) {
        // Get currently selected month and year
        const selectedMonthElement = document.getElementById('dataEntryMonthSelect');
        const selectedMonth = selectedMonthElement.value;
        
        if (selectedMonth === 'all') {
            return {
                success: false,
                error: 'יש לבחור חודש מסוים לפני ייבוא קובץ CSV.\nאנא בחר חודש מהתפריט הנפתח ונסה שוב.'
            };
        }

        // Parse CSV
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
            return {
                success: false,
                error: 'הקובץ ריק או לא מכיל נתונים.'
            };
        }

        // Parse header
        const header = lines[0].split(',').map(h => h.trim());
        const expectedHeaders = ['שנה', 'חודש', 'פריט', 'חובה', 'זכות'];
        
        // Validate header
        const hasCorrectHeaders = expectedHeaders.every((h, i) => 
            header[i] && header[i].replace(/"/g, '') === h
        );
        
        if (!hasCorrectHeaders) {
            return {
                success: false,
                error: 'כותרות הקובץ אינן תקינות.\nצפוי: שנה,חודש,פריט,חובה,זכות'
            };
        }

        // Map Hebrew month names to numbers
        const monthMap = {
            'ינואר': '01', 'פברואר': '02', 'מרץ': '03', 'אפריל': '04',
            'מאי': '05', 'יוני': '06', 'יולי': '07', 'אוגוסט': '08',
            'ספטמבר': '09', 'אוקטובר': '10', 'נובמבר': '11', 'דצמבר': '12'
        };

        const transactions = [];
        const checkItems = []; // Separate array for (שיק) items
        const months = new Set();
        const years = new Set();

        // Parse data rows
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // Parse CSV line (handle quotes)
            const values = this.parseCSVLine(line);
            
            if (values.length < 5) continue;

            const year = values[0].trim();
            const monthName = values[1].trim();
            // Remove " character and Hebrew geresh/gershayim from item name
            const item = values[2].trim().replace(/["\u0022\u05F4\u05F3]/g, '');
            const debit = values[3].trim(); // חובה (הוצאה)
            const credit = values[4].trim(); // זכות (הכנסה)

            // Check if this is a (שיק) item - item name is exactly "(שיק)"
            const isCheckItem = item === '(שיק)';

            // Convert month name to number
            const month = monthMap[monthName];
            if (!month) {
                return {
                    success: false,
                    error: `שם חודש לא תקין בשורה ${i + 1}: "${monthName}"\nצפוי: ינואר, פברואר, וכו'.`
                };
            }

            months.add(month);
            years.add(year);

            // Determine type and amount
            let amount, type;
            if (credit && credit !== '') {
                // זכות = הכנסה
                amount = parseFloat(credit);
                type = 'income';
            } else if (debit && debit !== '') {
                // חובה = הוצאה
                amount = -Math.abs(parseFloat(debit));
                type = 'expense';
            } else {
                continue; // Skip if both empty
            }

            if (isNaN(amount)) {
                return {
                    success: false,
                    error: `סכום לא תקין בשורה ${i + 1}: "${debit || credit}"`
                };
            }

            // If this is a (שיק) item, add to checkItems array instead
            if (isCheckItem) {
                // Convert month number to Hebrew name for default item name
                const monthNumberStr = month.padStart(2, '0');
                const hebrewMonthNames = {
                    '01': 'ינואר', '02': 'פברואר', '03': 'מרץ', '04': 'אפריל',
                    '05': 'מאי', '06': 'יוני', '07': 'יולי', '08': 'אוגוסט',
                    '09': 'ספטמבר', '10': 'אוקטובר', '11': 'נובמבר', '12': 'דצמבר'
                };
                const monthNameForItem = hebrewMonthNames[monthNumberStr] || monthName;

                checkItems.push({
                    id: Date.now() + Math.random(),
                    item: `הוצאות חודש ${monthNameForItem}`,
                    amount: amount,
                    month: parseInt(month),
                    year: parseInt(year),
                    note: '',
                    checkNumber: '',
                    payeeName: '',
                    color: 'yellow'
                });

                // Small delay to ensure unique IDs
                const now = Date.now();
                while (Date.now() === now) { /* wait */ }
                continue; // Skip adding to regular transactions
            }

            // Determine category
            let category;
            let isCheckPayment = item.toLowerCase().includes('שיק');
            if (isCheckPayment) {
                category = 'שונות';
            } else {
                // Use getCategoryForItem to handle special cases and normalization
                category = this.getCategoryForItem(item);
            }

            // Check if the item name is exactly "שיק" (without parentheses)
            let noteToAdd = '';
            if (item === 'שיק') {
                noteToAdd = 'צ\'יק';
                console.log(`Adding note "צ'יק" to item: ${item}`);
            }

            transactions.push({
                id: Date.now() + Math.random(),
                item: item,
                amount: amount,
                type: type,
                category: category,
                month: parseInt(month),
                year: parseInt(year),
                note: noteToAdd,
                paymentMethod: isCheckPayment ? 'check' : 'cash',
                checkDetails: isCheckPayment ? { checkNumber: '', payeeName: '' } : null,
                color: 'yellow' // Auto-color CSV imports as yellow
            });

            // Small delay to ensure unique IDs
            const now = Date.now();
            while (Date.now() === now) { /* wait */ }
        }

        // Validation: Check if all months match selected month
        if (months.size > 1) {
            return {
                success: false,
                error: `הקובץ מכיל עסקאות ממספר חודשים: ${Array.from(months).map(m => this.getMonthName(parseInt(m))).join(', ')}\nכל העסקאות בקובץ חייבות להיות מאותו חודש.`
            };
        }

        const csvMonth = Array.from(months)[0];
        if (csvMonth !== selectedMonth) {
            return {
                success: false,
                error: `אי-התאמה בין החודש הנבחר לחודש בקובץ!\n\nחודש נבחר באתר: ${this.getMonthName(parseInt(selectedMonth))}\nחודש בקובץ CSV: ${this.getMonthName(parseInt(csvMonth))}\n\nאנא בחר את החודש "${this.getMonthName(parseInt(csvMonth))}" ונסה שוב.`
            };
        }

        // Validation: Check if year matches
        if (years.size > 1) {
            return {
                success: false,
                error: `הקובץ מכיל עסקאות ממספר שנים: ${Array.from(years).join(', ')}\nכל העסקאות בקובץ חייבות להיות מאותה שנה.`
            };
        }

        const csvYear = Array.from(years)[0];
        if (parseInt(csvYear) !== this.currentYear) {
            return {
                success: false,
                error: `אי-התאמה בין השנה הנבחרת לשנה בקובץ!\n\nשנה נבחרת באתר: ${this.currentYear}\nשנה בקובץ CSV: ${csvYear}\n\nאנא בחר את השנה ${csvYear} ונסה שוב, או ערוך את הקובץ.`
            };
        }

        return {
            success: true,
            transactions: transactions,
            checkItems: checkItems
        };
    }

    // Parse CSV line handling quotes
    parseCSVLine(line) {
        const values = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    // Double quote - add single quote
                    current += '"';
                    i++;
                } else {
                    // Toggle quote mode
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                // End of field
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add last field
        values.push(current);
        
        return values;
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
                    if (data.manualOpeningBalances) {
                        this.manualOpeningBalances = new Set(data.manualOpeningBalances);
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
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return t.month === month && transactionYear === this.currentYear;
        });
        
        // Get user data for report
        const userData = this.getUserData();
        const reportProducer = userData ? `${userData.name}${userData.phone ? ` | 📞 ${userData.phone}` : ''}${userData.id ? ` | ת"ז ${userData.id}` : ''}` : 'לא צוין';
        
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
        
        const openingBalance = this.openingBalances.get(`${this.currentYear}-${month}`) || 0;
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
        <h2>${monthName} ${this.currentYear}</h2>
        <p>נוצר בתאריך: ${new Date(this.currentYear, new Date().getMonth(), new Date().getDate()).toLocaleDateString('he-IL')}</p>
        <p style="font-size: 0.9rem; opacity: 0.9;">מפיק הדוח: ${reportProducer}</p>
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

    ${(() => {
        // Get check payments from regular transactions
        const checkPayments = monthlyTransactions.filter(t => t.paymentMethod === 'check');
        if (checkPayments.length === 0) return '';
        
        const totalCheckAmount = checkPayments.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        return `
    <div class="summary-card">
        <h3>🏦 תשלומי צ'יקים בחודש</h3>
        <table class="balance-table">
            <thead>
                <tr>
                    <th>פריט</th>
                    <th>צ'יק מספר</th>
                    <th>מוטב</th>
                    <th>סכום</th>
                </tr>
            </thead>
            <tbody>
                ${checkPayments.map(t => `
                <tr>
                    <td>${t.item}</td>
                    <td>${t.checkDetails?.checkNumber || '(לא צוין)'}</td>
                    <td>${t.checkDetails?.payeeName || '(לא צוין)'}</td>
                    <td class="negative">${this.formatCurrency(t.amount)}</td>
                </tr>`).join('')}
                ${checkPayments.length > 1 ? `
                <tr style="background: #f5f5f5; font-weight: 600;">
                    <td colspan="3">סה"כ תשלומי צ'יקים (${checkPayments.length} צ'יקים)</td>
                    <td class="negative">${this.formatCurrency(totalCheckAmount)}</td>
                </tr>` : ''}
            </tbody>
        </table>
    </div>`;
    })()}

    ${(() => {
        // Get imported check items for this month
        const importedChecks = this.importedCheckItems.filter(item => {
            const itemYear = item.year || this.currentYear;
            return item.month === month && itemYear === this.currentYear;
        });
        
        if (importedChecks.length === 0) return '';
        
        const totalImportedAmount = importedChecks.reduce((sum, item) => sum + Math.abs(item.amount), 0);
        
        return `
    <div class="summary-card" style="background: #f3e5f5; border-color: #9c27b0;">
        <h3 style="color: #6a1b9a;">🏦 פרטי צ'יק הוצאות חודש ${monthName}</h3>
        <table class="balance-table">
            <thead>
                <tr>
                    <th>צ'יק מספר</th>
                    <th>מוטב</th>
                    <th>עבור</th>
                    <th>הערה</th>
                    <th>סכום</th>
                </tr>
            </thead>
            <tbody>
                ${importedChecks.map(item => `
                <tr>
                    <td>${item.checkNumber || '(לא הוזן)'}</td>
                    <td>${item.payeeName || '(לא הוזן)'}</td>
                    <td>${item.item}</td>
                    <td>${item.note || ''}</td>
                    <td style="color: #6a1b9a; font-weight: 600;">${this.formatCurrency(item.amount)}</td>
                </tr>`).join('')}
                ${importedChecks.length > 1 ? `
                <tr style="background: #e1bee7; font-weight: 600;">
                    <td colspan="4">סה"כ פריטי שיק (${importedChecks.length} פריטים)</td>
                    <td style="color: #6a1b9a;">${this.formatCurrency(totalImportedAmount)}</td>
                </tr>` : ''}
            </tbody>
        </table>
    </div>`;
    })()}
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

    exportDashboardReport(selectedMonth) {
        const monthName = this.getMonthName(selectedMonth);
        
        // Get user data for report
        const userData = this.getUserData();
        const reportProducer = userData ? `${userData.name}${userData.phone ? ` | 📞 ${userData.phone}` : ''}${userData.id ? ` | ת"ז ${userData.id}` : ''}` : 'לא צוין';
        
        // Monthly data (for selected month)
        const monthlyTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return t.month === selectedMonth && transactionYear === this.currentYear;
        });
        
        const monthlyExpenses = monthlyTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const monthlyIncome = monthlyTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const monthlyNet = monthlyIncome - monthlyExpenses;
        
        // Annual data (for entire year)
        const yearTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return transactionYear === this.currentYear;
        });
        
        const annualExpenses = yearTransactions
            .filter(t => t.type === 'expense')
            .reduce((sum, t) => sum + Math.abs(t.amount), 0);
        
        const annualIncome = yearTransactions
            .filter(t => t.type === 'income')
            .reduce((sum, t) => sum + t.amount, 0);
        
        const annualNet = annualIncome - annualExpenses;
        
        // Category breakdown for selected month
        const categoryTotals = {};
        monthlyTransactions.filter(t => t.type === 'expense').forEach(transaction => {
            const category = transaction.category || 'לא מקוטלג';
            categoryTotals[category] = (categoryTotals[category] || 0) + Math.abs(transaction.amount);
        });
        
        const sortedCategories = Object.entries(categoryTotals)
            .sort((a, b) => b[1] - a[1]);
        
        // Monthly summary table for entire year
        const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        const monthlySummaryRows = months.map(month => {
            const trans = this.transactions.filter(t => {
                const transactionYear = t.year || this.currentYear;
                return t.month === month && transactionYear === this.currentYear;
            });
            
            const expenses = trans
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + Math.abs(t.amount), 0);
            
            const income = trans
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            
            const net = income - expenses;
            
            return {
                month: this.getMonthName(month),
                income,
                expenses,
                net,
                isSelected: month === selectedMonth
            };
        });
        
        // Generate HTML report
        const reportHTML = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח סיכום כללי - ${this.currentYear}</title>
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
            color: #1f4e79;
        }
        .kpi-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
        }
        .kpi-item {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 6px;
            border: 2px solid;
        }
        .kpi-item.expenses { border-color: #dc3545; }
        .kpi-item.income { border-color: #28a745; }
        .kpi-item.net { border-color: #17a2b8; }
        .kpi-label {
            display: block;
            font-size: 0.85rem;
            color: #666;
            margin-bottom: 5px;
        }
        .kpi-value {
            display: block;
            font-size: 1.3rem;
            font-weight: 600;
        }
        .kpi-value.positive { color: #28a745; }
        .kpi-value.negative { color: #dc3545; }
        .table-container {
            background: white;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin-bottom: 15px;
        }
        .summary-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
        }
        .summary-table th, .summary-table td {
            padding: 8px 10px;
            text-align: right;
            border: 1px solid #ddd;
        }
        .summary-table th {
            background: #1f4e79;
            color: white;
            font-weight: 600;
        }
        .summary-table tr:nth-child(even) {
            background: #f8f9fa;
        }
        .summary-table tr.selected {
            background: #fff3cd !important;
            font-weight: 600;
        }
        .positive { color: #28a745; }
        .negative { color: #dc3545; }
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
            const htmlContent = document.documentElement.outerHTML;
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'דוח-סיכום-${this.currentYear}.html';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        }
    </script>
    
    <div class="report-header">
        <h1>📈 דוח סיכום כללי</h1>
        <h2>שנת ${this.currentYear}</h2>
        <p>נוצר בתאריך: ${new Date(this.currentYear, new Date().getMonth(), new Date().getDate()).toLocaleDateString('he-IL')}</p>
        <p style="font-size: 0.9rem; opacity: 0.9;">מפיק הדוח: ${reportProducer}</p>
    </div>

    <div class="summary-grid">
        <div class="summary-card">
            <h3>� סיכום שנתי - ${this.currentYear}</h3>
            <div class="kpi-grid">
                <div class="kpi-item expenses">
                    <span class="kpi-label">הוצאות:</span>
                    <span class="kpi-value">${this.formatCurrency(annualExpenses)}</span>
                </div>
                <div class="kpi-item income">
                    <span class="kpi-label">הכנסות:</span>
                    <span class="kpi-value">${this.formatCurrency(annualIncome)}</span>
                </div>
                <div class="kpi-item net" style="grid-column: 1 / -1;">
                    <span class="kpi-label">מאזן שנתי:</span>
                    <span class="kpi-value ${annualNet >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(annualNet)}</span>
                </div>
            </div>
        </div>
    </div>

    <div class="table-container">
        <h3>📅 סיכום חודשי - שנת ${this.currentYear}</h3>
        <table class="summary-table">
            <thead>
                <tr>
                    <th>חודש</th>
                    <th>הכנסות</th>
                    <th>הוצאות</th>
                    <th>מאזן</th>
                </tr>
            </thead>
            <tbody>
                ${monthlySummaryRows.map(row => `
                <tr${row.isSelected ? ' class="selected"' : ''}>
                    <td>${row.month}</td>
                    <td class="positive">${this.formatCurrency(row.income)}</td>
                    <td class="negative">${this.formatCurrency(row.expenses)}</td>
                    <td class="${row.net >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(row.net)}</td>
                </tr>`).join('')}
                <tr style="font-weight: 600; background: #e3f2fd;">
                    <td>סה"כ שנתי</td>
                    <td class="positive">${this.formatCurrency(annualIncome)}</td>
                    <td class="negative">${this.formatCurrency(annualExpenses)}</td>
                    <td class="${annualNet >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(annualNet)}</td>
                </tr>
            </tbody>
        </table>
    </div>

    ${this.generateCategoryBreakdownTable()}
</body>
</html>`;

        // Open report in new window
        const newWindow = window.open('', '_blank', 'width=1000,height=800,menubar=yes,toolbar=yes,location=no,status=yes,scrollbars=yes,resizable=yes');
        
        if (newWindow) {
            newWindow.document.write(reportHTML);
            newWindow.document.close();
            
            // Add keyboard shortcuts
            newWindow.addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.key === 'p') {
                    e.preventDefault();
                    newWindow.print();
                }
                if (e.key === 'Escape') {
                    newWindow.close();
                }
            });
            
            this.showNotification(`דוח סיכום נפתח בחלון חדש - Ctrl+P להדפסה, לחץ על 💾 לשמירה כ-HTML, או Esc לסגירה`, 'success');
        } else {
            // Fallback if popup is blocked
            const reportBlob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(reportBlob);
            link.download = `דוח-סיכום-${this.currentYear}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            this.showNotification(`החלון נחסם - הדוח נשמר כקובץ`, 'info');
        }
    }

    generateCategoryBreakdownTable() {
        // Filter by current year
        const currentYearTransactions = this.transactions.filter(t => {
            const transactionYear = t.year || this.currentYear;
            return transactionYear === this.currentYear;
        });
        
        if (currentYearTransactions.length === 0) {
            return `
                <div class="table-container">
                    <h3>📋 טבלת סיכום שנתי - פילוח קטגוריות חודשי</h3>
                    <p style="text-align: center; color: #666; padding: 20px;">אין עסקאות לשנה ${this.currentYear}</p>
                </div>
            `;
        }
        
        // Collect all categories from actual data
        const allCategories = new Set();
        currentYearTransactions.forEach(transaction => {
            let category = transaction.category || 'שונות';
            // Handle special income category mapping
            if (category === 'משכורת' || category === 'ביטוח לאומי' || category === 'מענק עבודה') {
                category = 'משכורת + ביטוח לאומי';
            }
            allCategories.add(category);
        });
        
        // Convert to sorted array - income category first, then alphabetically
        const categories = Array.from(allCategories).sort((a, b) => {
            if (a === 'משכורת + ביטוח לאומי') return -1;
            if (b === 'משכורת + ביטוח לאומי') return 1;
            return a.localeCompare(b, 'he');
        });
        
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
        
        // Initialize ALL category totals to 0
        categories.forEach(cat => {
            categoryTotals[cat] = 0;
        });
        
        currentYearTransactions.forEach(transaction => {
            const month = parseInt(transaction.month);
            let category = transaction.category || 'שונות';
            
            // Skip if month is invalid
            if (!month || isNaN(month) || month < 1 || month > 12) {
                return;
            }
            
            // Handle special income category mapping
            if (category === 'משכורת' || category === 'ביטוח לאומי' || category === 'מענק עבודה') {
                category = 'משכורת + ביטוח לאומי';
            }
            
            // For income transactions, use positive amount; for expenses, use absolute value
            const amount = transaction.type === 'income' ? transaction.amount : Math.abs(transaction.amount);
            
            monthlyData[month][category] += amount;
            categoryTotals[category] += amount;
        });
        
        // Calculate monthly totals (Income - Expenses)
        const monthlyTotals = {};
        for (let month = 1; month <= 12; month++) {
            const income = monthlyData[month]['משכורת + ביטוח לאומי'] || 0;
            const expenses = categories
                .filter(cat => cat !== 'משכורת + ביטוח לאומי')
                .reduce((sum, cat) => sum + (monthlyData[month][cat] || 0), 0);
            monthlyTotals[month] = income - expenses;
        }
        
        // Calculate totals
        const incomeTotal = categoryTotals['משכורת + ביטוח לאומי'] || 0;
        const expenseCategories = categories.filter(cat => cat !== 'משכורת + ביטוח לאומי');
        const expenseTotal = expenseCategories.reduce((sum, cat) => sum + categoryTotals[cat], 0);
        const annualNetTotal = incomeTotal - expenseTotal;
        
        // Build HTML table with inline styles matching the dashboard
        let tableHTML = `
            <div class="table-container" style="page-break-before: always;">
                <h3>📋 טבלת סיכום שנתי - פילוח קטגוריות חודשי</h3>
                <div style="overflow-x: auto;">
                    <table class="summary-table" style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                        <thead>
                            <tr>
                                <th style="width: 80px; padding: 6px 8px; text-align: right; border: 1px solid #ddd; background: #1f4e79; color: white; font-weight: 600; white-space: nowrap;">חודש</th>
                                ${categories.map(cat => {
                                    const isIncome = cat === 'משכורת + ביטוח לאומי';
                                    return `<th style="min-width: 70px; padding: 6px 8px; text-align: right; border: 1px solid #ddd; background: ${isIncome ? '#4caf50' : '#1f4e79'}; color: white; font-weight: 600; font-size: 0.7rem; white-space: nowrap;">${cat}</th>`;
                                }).join('')}
                                <th style="min-width: 80px; padding: 6px 8px; text-align: right; border: 1px solid #ddd; background: #1976d2; color: white; font-weight: 600; white-space: nowrap;">יתרה נטו</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        // Add rows for each month
        for (let month = 1; month <= 12; month++) {
            const monthName = this.getMonthName(month);
            const rowBg = month % 2 === 0 ? '#f8f9fa' : 'white';
            tableHTML += `
                            <tr style="background: ${rowBg};">
                                <td style="padding: 6px 8px; text-align: right; border: 1px solid #ddd; font-weight: 600; white-space: nowrap;">${monthName}</td>
                                ${categories.map(cat => {
                                    const amount = monthlyData[month][cat] || 0;
                                    const isIncome = cat === 'משכורת + ביטוח לאומי';
                                    const cellBg = isIncome ? '#e8f5e9' : '';
                                    const cellColor = amount === 0 ? '#ccc' : (isIncome ? '#2e7d32' : '#333');
                                    return `<td style="padding: 6px 8px; text-align: right; border: 1px solid #ddd; background: ${cellBg}; color: ${cellColor}; white-space: nowrap;">${
                                        amount === 0 ? '-' : this.formatCurrency(amount)
                                    }</td>`;
                                }).join('')}
                                <td style="padding: 6px 8px; text-align: right; border: 1px solid #ddd; font-weight: 600; color: ${monthlyTotals[month] >= 0 ? '#2e7d32' : '#c62828'}; white-space: nowrap;">${
                                    monthlyTotals[month] === 0 ? '-' : this.formatCurrency(monthlyTotals[month])
                                }</td>
                            </tr>
            `;
        }
        
        // Add totals row
        tableHTML += `
                            <tr style="background: #e3f2fd; font-weight: 600;">
                                <td style="padding: 8px; text-align: right; border: 1px solid #ddd; white-space: nowrap;">סה״כ שנתי</td>
                                ${categories.map(cat => {
                                    const amount = categoryTotals[cat] || 0;
                                    const isIncome = cat === 'משכורת + ביטוח לאומי';
                                    const cellBg = isIncome ? '#c8e6c9' : '#e3f2fd';
                                    return `<td style="padding: 8px; text-align: right; border: 1px solid #ddd; background: ${cellBg}; white-space: nowrap;">${
                                        amount === 0 ? '-' : this.formatCurrency(amount)
                                    }</td>`;
                                }).join('')}
                                <td style="padding: 8px; text-align: right; border: 1px solid #ddd; background: ${annualNetTotal >= 0 ? '#4caf50' : '#f44336'}; color: white; font-weight: 600; white-space: nowrap;">
                                    ${this.formatCurrency(annualNetTotal)}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        return tableHTML;
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
            const checkNum = transaction.checkDetails.checkNumber && transaction.checkDetails.checkNumber !== 'N/A'
                ? transaction.checkDetails.checkNumber
                : '(לא הוזן)';
            const payee = transaction.checkDetails.payeeName && transaction.checkDetails.payeeName !== 'לא צוין'
                ? transaction.checkDetails.payeeName
                : '(לא הוזן)';
            
            const item = document.createElement('div');
            item.className = 'check-payment-item';
            item.innerHTML = `
                <div class="check-payment-details">
                    <div class="check-payment-number">צ'יק מספר: ${checkNum}</div>
                    <div class="check-payment-payee">מוטב: ${payee}</div>
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

    // Update imported check items for monthly view
    updateImportedCheckItemsMonthly(month) {
        const container = document.getElementById('importedCheckItemsMonthlyList');
        const summaryCard = document.getElementById('importedCheckItemsMonthly');

        if (!container || !summaryCard) return;

        // Filter check items by current year and selected month
        const filteredCheckItems = this.importedCheckItems.filter(item => {
            const itemYear = item.year || this.currentYear;
            return item.month === month && itemYear === this.currentYear;
        });

        if (filteredCheckItems.length === 0) {
            summaryCard.style.display = 'none';
            return;
        }

        summaryCard.style.display = 'block';

        // Update the title with month name
        const titleElement = summaryCard.querySelector('h3');
        if (titleElement) {
            const monthName = this.getMonthName(month);
            titleElement.textContent = `🏦 פרטי צ׳יק הוצאות חודש ${monthName}`;
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
                </div>
                <div class="check-payment-amount">${this.formatCurrency(checkItem.amount)}</div>
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
            white-space: pre-wrap;
            max-width: 400px;
            line-height: 1.5;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Calculate display time based on message length (longer messages need more time)
        const displayTime = message.includes('\n') ? 5000 : 3000; // 5 seconds for multi-line, 3 for single
        
        // Remove notification after display time
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, displayTime);
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
        
        // Collect all categories from actual data
        const allCategories = new Set();
        currentYearTransactions.forEach(transaction => {
            let category = transaction.category || 'שונות';
            // Handle special income category mapping
            if (category === 'משכורת' || category === 'ביטוח לאומי' || category === 'מענק עבודה') {
                category = 'משכורת + ביטוח לאומי';
            }
            allCategories.add(category);
        });
        
        // Convert to sorted array - income category first, then alphabetically
        const categories = Array.from(allCategories).sort((a, b) => {
            if (a === 'משכורת + ביטוח לאומי') return -1;
            if (b === 'משכורת + ביטוח לאומי') return 1;
            return a.localeCompare(b, 'he');
        });
        
        console.log('Categories found:', categories);
        
        // Process data for all 12 months
        const monthlyData = {};
        const categoryTotals = {};
        
        // Initialize data structures - MUST initialize totals to 0
        for (let month = 1; month <= 12; month++) {
            monthlyData[month] = {};
            categories.forEach(cat => {
                monthlyData[month][cat] = 0;
            });
        }
        
        // Initialize ALL category totals to 0
        categories.forEach(cat => {
            categoryTotals[cat] = 0;
        });
        
        console.log('Categories after initialization:', categories);
        console.log('Sample monthlyData for month 1:', monthlyData[1]);
        
        currentYearTransactions.forEach((transaction, idx) => {
            // CRITICAL: Parse month as integer to match monthlyData initialization
            const month = parseInt(transaction.month);
            let category = transaction.category || 'שונות';
            
            // Debug first few transactions
            if (idx < 3) {
                console.log(`Transaction ${idx}:`, { 
                    item: transaction.item, 
                    month, 
                    monthType: typeof month,
                    originalMonth: transaction.month,
                    type: transaction.type, 
                    amount: transaction.amount, 
                    category 
                });
            }
            
            // Skip if month is invalid
            if (!month || isNaN(month) || month < 1 || month > 12) {
                console.warn('Invalid month for transaction:', transaction);
                return;
            }
            
            // Handle special income category mapping
            if (category === 'משכורת' || category === 'ביטוח לאומי' || category === 'מענק עבודה') {
                category = 'משכורת + ביטוח לאומי';
            }
            
            // For income transactions, use positive amount; for expenses, use absolute value
            const amount = transaction.type === 'income' ? transaction.amount : Math.abs(transaction.amount);
            
            // Add amount to category (monthlyData[month] should always exist after initialization)
            if (!monthlyData[month][category]) {
                monthlyData[month][category] = 0;
            }
            monthlyData[month][category] += amount;
            
            if (!categoryTotals[category]) {
                categoryTotals[category] = 0;
            }
            categoryTotals[category] += amount;
        });
        
        console.log('Monthly data sample (month 1):', monthlyData[1]);
        console.log('Category totals:', categoryTotals);
        console.log('Number of categories:', categories.length);
        console.log('Categories list:', categories);
        console.log('✅ Transactions processing completed successfully!');
        
        // Calculate monthly totals (Income - Expenses)
        const monthlyTotals = {};
        for (let month = 1; month <= 12; month++) {
            const income = (monthlyData[month] && monthlyData[month]['משכורת + ביטוח לאומי']) || 0;
            const expenses = categories
                .filter(cat => cat !== 'משכורת + ביטוח לאומי')
                .reduce((sum, cat) => sum + ((monthlyData[month] && monthlyData[month][cat]) || 0), 0);
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
                        const amount = (monthlyData[month] && monthlyData[month][cat]) || 0;
                        const isIncome = cat === 'משכורת + ביטוח לאומי';
                        return `<td class="category-amount ${amount === 0 ? 'zero' : ''} ${isIncome ? 'income-cell' : ''}">${
                            amount === 0 ? '-' : this.formatCurrency(amount)
                        }</td>`;
                    }).join('')}
                    <td class="total-monthly ${(monthlyTotals[month] || 0) >= 0 ? 'positive' : 'negative'}">${
                        (monthlyTotals[month] === 0 || !monthlyTotals[month]) ? '-' : this.formatCurrency(monthlyTotals[month])
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
                        const amount = categoryTotals[cat] || 0;
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
        
        console.log('Table HTML length:', tableHTML.length, 'chars');
        console.log('Table HTML preview (first 500 chars):', tableHTML.substring(0, 500));
        console.log('Number of <tr> tags in table:', (tableHTML.match(/<tr>/g) || []).length);
        console.log('Setting container innerHTML...');
        container.innerHTML = tableHTML;
        console.log('✅ Container innerHTML set successfully! Table should now be visible.');
        
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
