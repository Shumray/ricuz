// Dropbox Sync Manager
// Handles all cloud synchronization with Dropbox

class DropboxSync {
    constructor(budgetSystem) {
        this.budgetSystem = budgetSystem;
        this.accessToken = null;
        this.filePath = '/budget-data.json';
        this.autoSyncEnabled = false;
        this.biDirectionalSyncEnabled = false;
        this.syncInProgress = false;
        this.lastSyncTime = null;
        this.lastRemoteModified = null;
        this.syncCheckInterval = null;
        this.syncIntervalMinutes = 2; // Check every 2 minutes
        
        this.loadSettings();
        this.initializeUI();
        this.startBiDirectionalSync();
    }

    // Load Dropbox settings from localStorage
    loadSettings() {
        const settings = localStorage.getItem('dropboxSettings');
        if (settings) {
            try {
                const parsed = JSON.parse(settings);
                this.accessToken = parsed.accessToken || null;
                this.filePath = parsed.filePath || '/budget-data.json';
                this.autoSyncEnabled = parsed.autoSyncEnabled || false;
                this.biDirectionalSyncEnabled = parsed.biDirectionalSyncEnabled || false;
                this.lastSyncTime = parsed.lastSyncTime || null;
                this.lastRemoteModified = parsed.lastRemoteModified || null;
            } catch (e) {
                console.error('Error loading Dropbox settings:', e);
            }
        }
    }

    // Save Dropbox settings to localStorage
    saveSettings() {
        const settings = {
            accessToken: this.accessToken,
            filePath: this.filePath,
            autoSyncEnabled: this.autoSyncEnabled,
            biDirectionalSyncEnabled: this.biDirectionalSyncEnabled,
            lastSyncTime: this.lastSyncTime,
            lastRemoteModified: this.lastRemoteModified
        };
        localStorage.setItem('dropboxSettings', JSON.stringify(settings));
    }

    // Initialize UI elements and event listeners
    initializeUI() {
        console.log('🔧 Initializing Dropbox UI...');
        
        // Access Token input
        const tokenInput = document.getElementById('dropboxAccessToken');
        if (tokenInput) {
            if (this.accessToken) {
                tokenInput.value = this.accessToken;
                console.log('✅ Token loaded from storage');
            }
        } else {
            console.warn('⚠️ Token input not found');
        }

        // Auto-sync checkbox
        const autoSyncCheckbox = document.getElementById('dropboxAutoSync');
        if (autoSyncCheckbox) {
            autoSyncCheckbox.checked = this.autoSyncEnabled;
            autoSyncCheckbox.addEventListener('change', (e) => {
                this.autoSyncEnabled = e.target.checked;
                this.saveSettings();
                this.updateSyncStatus();
                console.log(`🔄 Auto-sync ${this.autoSyncEnabled ? 'enabled' : 'disabled'}`);
            });
        } else {
            console.warn('⚠️ Auto-sync checkbox not found');
        }

        // Bi-directional sync checkbox
        const biDirectionalSyncCheckbox = document.getElementById('dropboxBiDirectionalSync');
        if (biDirectionalSyncCheckbox) {
            biDirectionalSyncCheckbox.checked = this.biDirectionalSyncEnabled;
            biDirectionalSyncCheckbox.addEventListener('change', (e) => {
                this.biDirectionalSyncEnabled = e.target.checked;
                this.saveSettings();
                this.updateSyncStatus();
                this.startBiDirectionalSync();
                console.log(`🔁 Bi-directional sync ${this.biDirectionalSyncEnabled ? 'enabled' : 'disabled'}`);
            });
        } else {
            console.warn('⚠️ Bi-directional sync checkbox not found');
        }

        // Save token button
        const saveTokenBtn = document.getElementById('saveDropboxTokenBtn');
        if (saveTokenBtn) {
            saveTokenBtn.addEventListener('click', () => {
                console.log('💾 Save token clicked');
                this.saveAccessToken();
            });
            console.log('✅ Save token button connected');
        } else {
            console.warn('⚠️ Save token button not found');
        }

        // Manual sync buttons
        const uploadBtn = document.getElementById('uploadToDropboxBtn');
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                console.log('📤 Upload button clicked');
                this.uploadToDropbox();
            });
            console.log('✅ Upload button connected');
        } else {
            console.warn('⚠️ Upload button not found');
        }

        const downloadBtn = document.getElementById('downloadFromDropboxBtn');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                console.log('📥 Download button clicked');
                this.downloadFromDropbox();
            });
            console.log('✅ Download button connected');
        } else {
            console.warn('⚠️ Download button not found');
        }

        // Test connection button
        const testBtn = document.getElementById('testDropboxConnectionBtn');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                console.log('🔌 Test connection clicked');
                this.testConnection();
            });
            console.log('✅ Test connection button connected');
        } else {
            console.warn('⚠️ Test connection button not found');
        }

        // Update sync status display
        this.updateSyncStatus();
        console.log('✅ Dropbox UI initialized');
    }

    // Save access token from input
    saveAccessToken() {
        console.log('💾 saveAccessToken called');
        
        const tokenInput = document.getElementById('dropboxAccessToken');
        if (!tokenInput) {
            console.error('❌ Token input element not found!');
            return;
        }

        const token = tokenInput.value.trim();
        console.log(`📝 Token length: ${token.length} characters`);
        
        if (!token) {
            console.warn('⚠️ Empty token provided');
            this.budgetSystem.showNotification('❌ יש להזין Dropbox Access Token', 'error');
            return;
        }

        this.accessToken = token;
        this.saveSettings();
        console.log('✅ Token saved to localStorage');
        
        this.budgetSystem.showNotification('✅ Token נשמר בהצלחה!', 'success');
        this.updateSyncStatus();
    }

    // Test Dropbox connection
    async testConnection() {
        console.log('🔌 Testing Dropbox connection...');
        
        if (!this.accessToken) {
            console.warn('⚠️ No access token available');
            this.budgetSystem.showNotification('❌ לא הוגדר Access Token', 'error');
            return;
        }

        try {
            console.log('📡 Sending request to Dropbox API...');
            const response = await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(null)
            });

            console.log(`📡 Response status: ${response.status}`);

            if (response.ok) {
                const data = await response.json();
                console.log('✅ Connection successful!', data);
                this.budgetSystem.showNotification(`✅ התחברות הצליחה! שלום ${data.name.display_name}`, 'success');
            } else {
                const errorText = await response.text();
                console.error('❌ Connection failed:', response.status, errorText);
                throw new Error('Connection failed');
            }
        } catch (error) {
            console.error('❌ Dropbox connection test failed:', error);
            this.budgetSystem.showNotification('❌ הבדיקה נכשלה - בדוק את ה-Token', 'error');
        }
    }

    // Upload data to Dropbox
    async uploadToDropbox(silent = false) {
        if (!this.accessToken) {
            if (!silent) {
                this.budgetSystem.showNotification('❌ לא הוגדר Access Token', 'error');
            }
            return false;
        }

        if (this.syncInProgress) {
            if (!silent) {
                this.budgetSystem.showNotification('⏳ סנכרון כבר מתבצע...', 'info');
            }
            return false;
        }

        this.syncInProgress = true;
        this.updateSyncStatus();

        try {
            // Collect all budget data
            const data = {
                transactions: this.budgetSystem.transactions,
                importedCheckItems: this.budgetSystem.importedCheckItems,
                mappings: Array.from(this.budgetSystem.mappings.entries()),
                categories: this.budgetSystem.categories,
                openingBalances: Array.from(this.budgetSystem.openingBalances.entries()),
                manualOpeningBalances: Array.from(this.budgetSystem.manualOpeningBalances),
                monthlyNotes: this.budgetSystem.monthlyNotes ? Array.from(this.budgetSystem.monthlyNotes.entries()) : [],
                lastSelectedMonth: this.budgetSystem.lastSelectedMonth,
                lastSelectedYear: this.budgetSystem.lastSelectedYear,
                lastSelectedColor: this.budgetSystem.lastSelectedColor,
                currentYear: this.budgetSystem.currentYear,
                exportDate: new Date().toISOString(),
                version: '1.0'
            };

            const jsonData = JSON.stringify(data, null, 2);

            const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/octet-stream',
                    'Dropbox-API-Arg': JSON.stringify({
                        path: this.filePath,
                        mode: 'overwrite',
                        autorename: false,
                        mute: false
                    })
                },
                body: jsonData
            });

            if (response.ok) {
                const result = await response.json();
                
                // Store the server modified time
                if (result.server_modified) {
                    this.lastRemoteModified = result.server_modified;
                    console.log('📅 Updated lastRemoteModified after upload:', this.lastRemoteModified);
                }
                
                this.lastSyncTime = new Date().toISOString();
                this.saveSettings();
                this.updateSyncStatus();
                
                if (!silent) {
                    this.budgetSystem.showNotification('✅ הנתונים הועלו ל-Dropbox בהצלחה!', 'success');
                }
                return true;
            } else {
                const errorData = await response.json();
                console.error('Dropbox upload failed:', errorData);
                
                // Check for permission errors
                if (errorData.error_summary && errorData.error_summary.includes('missing_scope')) {
                    throw new Error('⚠️ ה-Token חסר הרשאות!\n\n' +
                        '1. היכנס ל-Dropbox App Console\n' +
                        '2. עבור לטאב Permissions\n' +
                        '3. סמן: files.content.write, files.content.read, files.metadata.write, files.metadata.read\n' +
                        '4. לחץ Submit\n' +
                        '5. חזור לטאב Settings\n' +
                        '6. ⚡ צור Token חדש (הישן לא יעבוד!)\n' +
                        '7. הדבק את ה-Token החדש במערכת');
                }
                
                throw new Error(errorData.error_summary || 'Upload failed');
            }
        } catch (error) {
            console.error('Dropbox upload error:', error);
            if (!silent) {
                this.budgetSystem.showNotification('❌ שגיאה בהעלאה ל-Dropbox: ' + error.message, 'error');
            }
            return false;
        } finally {
            this.syncInProgress = false;
            this.updateSyncStatus();
        }
    }

    // Download data from Dropbox
    async downloadFromDropbox(silent = false) {
        if (!this.accessToken) {
            if (!silent) {
                this.budgetSystem.showNotification('❌ לא הוגדר Access Token', 'error');
            }
            return false;
        }

        if (this.syncInProgress) {
            if (!silent) {
                this.budgetSystem.showNotification('⏳ סנכרון כבר מתבצע...', 'info');
            }
            return false;
        }

        // Confirm before overwriting local data (skip if silent)
        if (!silent && !confirm('⚠️ פעולה זו תשכתב את כל הנתונים המקומיים. האם להמשיך?')) {
            return false;
        }

        this.syncInProgress = true;
        this.updateSyncStatus();

        try {
            const response = await fetch('https://content.dropboxapi.com/2/files/download', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Dropbox-API-Arg': JSON.stringify({
                        path: this.filePath
                    })
                }
            });

            if (response.ok) {
                // Get the remote modified time from response headers
                const dropboxApiResult = response.headers.get('Dropbox-API-Result');
                if (dropboxApiResult) {
                    try {
                        const metadata = JSON.parse(dropboxApiResult);
                        this.lastRemoteModified = metadata.server_modified;
                        console.log('📅 Updated lastRemoteModified:', this.lastRemoteModified);
                    } catch (e) {
                        console.warn('Could not parse Dropbox-API-Result header');
                    }
                }
                
                const jsonText = await response.text();
                const data = JSON.parse(jsonText);

                // Load the data into the budget system
                this.budgetSystem.transactions = data.transactions || [];
                this.budgetSystem.importedCheckItems = data.importedCheckItems || [];
                
                // Restore mappings
                this.budgetSystem.mappings = new Map(data.mappings || []);
                
                // Restore categories
                if (data.categories && data.categories.length > 0) {
                    this.budgetSystem.categories = data.categories;
                }
                
                // Restore opening balances
                this.budgetSystem.openingBalances = new Map(data.openingBalances || []);
                this.budgetSystem.manualOpeningBalances = new Set(data.manualOpeningBalances || []);
                
                // Restore monthly notes
                this.budgetSystem.monthlyNotes = new Map(data.monthlyNotes || []);
                
                // Restore last selections
                if (data.lastSelectedMonth) {
                    this.budgetSystem.lastSelectedMonth = data.lastSelectedMonth;
                }
                if (data.lastSelectedYear) {
                    this.budgetSystem.lastSelectedYear = data.lastSelectedYear;
                }
                if (data.lastSelectedColor) {
                    this.budgetSystem.lastSelectedColor = data.lastSelectedColor;
                }
                if (data.currentYear) {
                    this.budgetSystem.currentYear = data.currentYear;
                }

                // Save to localStorage
                this.budgetSystem.saveData();

                // Update all displays
                this.budgetSystem.updateDisplay();

                this.lastSyncTime = new Date().toISOString();
                this.saveSettings();
                this.updateSyncStatus();

                if (!silent) {
                    this.budgetSystem.showNotification('✅ הנתונים הורדו מ-Dropbox בהצלחה!', 'success');
                }
                return true;
            } else {
                const errorText = await response.text();
                let errorMsg = 'Download failed';
                
                try {
                    const errorData = JSON.parse(errorText);
                    if (errorData.error['.tag'] === 'path' && errorData.error.path['.tag'] === 'not_found') {
                        errorMsg = 'הקובץ לא נמצא ב-Dropbox. נסה להעלות קודם.';
                    } else {
                        errorMsg = errorData.error_summary || errorMsg;
                    }
                } catch (e) {
                    // Use default error message
                }
                
                throw new Error(errorMsg);
            }
        } catch (error) {
            console.error('Dropbox download error:', error);
            if (!silent) {
                this.budgetSystem.showNotification('❌ שגיאה בהורדה מ-Dropbox: ' + error.message, 'error');
            }
            return false;
        } finally {
            this.syncInProgress = false;
            this.updateSyncStatus();
        }
    }

    // Update sync status display
    updateSyncStatus() {
        const statusElement = document.getElementById('dropboxSyncStatus');
        if (!statusElement) {
            console.warn('⚠️ Sync status element not found');
            return;
        }

        let statusHTML = '';

        if (!this.accessToken) {
            statusHTML = '<span style="color: #dc3545;">❌ לא מחובר</span>';
        } else if (this.syncInProgress) {
            statusHTML = '<span style="color: #ffc107;">⏳ מסנכרן...</span>';
        } else if (this.lastSyncTime) {
            const lastSync = new Date(this.lastSyncTime);
            const timeAgo = this.getTimeAgo(lastSync);
            statusHTML = `<span style="color: #28a745;">✅ מחובר</span> | סנכרון אחרון: ${timeAgo}`;
        } else {
            statusHTML = '<span style="color: #28a745;">✅ מחובר</span> | טרם סונכרן';
        }

        if (this.autoSyncEnabled && this.accessToken) {
            statusHTML += ' | <span style="color: #007bff;">🔄 סנכרון אוטומטי מופעל</span>';
        }

        if (this.biDirectionalSyncEnabled && this.accessToken) {
            statusHTML += ' | <span style="color: #17a2b8;">🔁 סנכרון דו-כיווני פעיל</span>';
        }

        statusElement.innerHTML = statusHTML;
        console.log('📊 Sync status updated:', this.accessToken ? 'Connected' : 'Disconnected');
    }

    // Get human-readable time ago string
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'כרגע';
        if (diffMins < 60) return `לפני ${diffMins} דקות`;
        if (diffHours < 24) return `לפני ${diffHours} שעות`;
        if (diffDays === 1) return 'אתמול';
        if (diffDays < 7) return `לפני ${diffDays} ימים`;
        
        return date.toLocaleDateString('he-IL', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Auto-sync when data changes (called from BudgetSystem.saveData)
    async autoSync() {
        if (this.autoSyncEnabled && this.accessToken && !this.syncInProgress) {
            console.log('Auto-syncing to Dropbox...');
            await this.uploadToDropbox(true); // Silent upload
        }
    }

    // Start bi-directional sync checking
    startBiDirectionalSync() {
        // Stop existing interval if any
        this.stopBiDirectionalSync();

        if (this.biDirectionalSyncEnabled && this.accessToken) {
            console.log(`🔁 Starting bi-directional sync (checking every ${this.syncIntervalMinutes} minutes)`);
            
            // Check immediately
            this.checkForRemoteUpdates();
            
            // Set up periodic checking
            this.syncCheckInterval = setInterval(() => {
                this.checkForRemoteUpdates();
            }, this.syncIntervalMinutes * 60 * 1000);
        }
    }

    // Stop bi-directional sync checking
    stopBiDirectionalSync() {
        if (this.syncCheckInterval) {
            clearInterval(this.syncCheckInterval);
            this.syncCheckInterval = null;
            console.log('🔁 Bi-directional sync stopped');
        }
    }

    // Check if there are remote updates
    async checkForRemoteUpdates() {
        if (!this.accessToken || this.syncInProgress) {
            return;
        }

        try {
            console.log('🔍 Checking for remote updates...');
            
            // Get file metadata
            const response = await fetch('https://api.dropboxapi.com/2/files/get_metadata', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: this.filePath,
                    include_media_info: false,
                    include_deleted: false,
                    include_has_explicit_shared_members: false
                })
            });

            if (response.ok) {
                const metadata = await response.json();
                const remoteModified = new Date(metadata.server_modified);
                
                console.log('📅 Remote file modified:', remoteModified.toISOString());
                
                // Check if remote file is newer
                if (this.lastRemoteModified) {
                    const lastKnown = new Date(this.lastRemoteModified);
                    
                    if (remoteModified > lastKnown) {
                        console.log('🆕 Remote file is newer! Downloading...');
                        await this.downloadFromDropbox(true); // Silent download
                        this.budgetSystem.showNotification('🔄 עדכון חדש התקבל מ-Dropbox!', 'info');
                    } else {
                        console.log('✅ Local data is up to date');
                    }
                } else {
                    // First time - just store the date
                    this.lastRemoteModified = remoteModified.toISOString();
                    this.saveSettings();
                    console.log('📌 Stored initial remote modified date');
                }
            } else if (response.status === 409) {
                // File not found - this is normal on first upload
                console.log('ℹ️ File not found in Dropbox yet');
            } else {
                console.warn('⚠️ Could not check remote file:', response.status);
            }
        } catch (error) {
            console.error('❌ Error checking for remote updates:', error);
        }
    }

    // Show help modal for getting Dropbox token
    showHelpModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <span class="close">&times;</span>
                <h2>📖 איך מקבלים Dropbox Access Token?</h2>
                
                <div style="text-align: right; line-height: 1.8;">
                    <h3>שלב 1: צור Dropbox App</h3>
                    <ol style="margin-right: 20px;">
                        <li>היכנס ל-<a href="https://www.dropbox.com/developers/apps" target="_blank" style="color: #007bff;">Dropbox App Console</a></li>
                        <li>לחץ על <strong>"Create app"</strong></li>
                        <li>בחר <strong>"Scoped access"</strong></li>
                        <li>בחר <strong>"Full Dropbox"</strong> access</li>
                        <li>תן שם לאפליקציה (למשל: "Budget System")</li>
                        <li>לחץ <strong>"Create app"</strong></li>
                    </ol>

                    <h3>שלב 2: הגדר הרשאות ⚠️ (חובה!)</h3>
                    <div style="background: #f8d7da; padding: 12px; border-radius: 6px; margin-bottom: 10px; border-right: 4px solid #dc3545;">
                        <strong style="color: #721c24;">🚨 חשוב מאוד!</strong> בלי ההרשאות הנכונות, לא תוכל לשמור קבצים!
                    </div>
                    <ol style="margin-right: 20px;">
                        <li>עבור לטאב <strong>"Permissions"</strong></li>
                        <li><strong>סמן את כל 4 ההרשאות הבאות (חובה!):</strong>
                            <ul style="margin-right: 30px; margin-top: 8px; line-height: 1.8;">
                                <li style="background: #d4edda; padding: 5px; margin: 3px 0; border-radius: 4px;">✅ <strong>files.metadata.write</strong></li>
                                <li style="background: #d4edda; padding: 5px; margin: 3px 0; border-radius: 4px;">✅ <strong>files.metadata.read</strong></li>
                                <li style="background: #d4edda; padding: 5px; margin: 3px 0; border-radius: 4px;">✅ <strong>files.content.write</strong> 🔥 (הכי חשוב!)</li>
                                <li style="background: #d4edda; padding: 5px; margin: 3px 0; border-radius: 4px;">✅ <strong>files.content.read</strong> 🔥 (הכי חשוב!)</li>
                            </ul>
                        </li>
                        <li><strong style="color: #dc3545;">לחץ "Submit" למטה!</strong> (הרשאות לא נשמרות בלי זה)</li>
                        <li>⚠️ <strong>אם כבר יצרת Token בלי ההרשאות - צור Token חדש!</strong></li>
                    </ol>

                    <h3>שלב 3: צור Access Token</h3>
                    <ol style="margin-right: 20px;">
                        <li>חזור לטאב <strong>"Settings"</strong></li>
                        <li>גלול למטה ל-<strong>"Generated access token"</strong></li>
                        <li>לחץ על <strong>"Generate"</strong></li>
                        <li>העתק את ה-Token שנוצר</li>
                        <li>הדבק אותו בשדה למעלה ולחץ "שמור Token"</li>
                    </ol>

                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 20px; border-right: 4px solid #ffc107;">
                        <strong>⚠️ חשוב:</strong> שמור את ה-Token במקום מאובטח! אם תאבד אותו, תצטרך ליצור חדש.
                    </div>

                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-top: 15px; border-right: 4px solid #0dcaf0;">
                        <strong>💡 טיפ:</strong> ה-Token תקף לתמיד עד שתמחק אותו ידנית או תמחק את האפליקציה.
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => modal.remove();
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }

    // Show "What is saved" information modal
    showWhatIsSavedModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'flex';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 800px;">
                <span class="close">&times;</span>
                <h2>📦 מה נשמר בסנכרון Dropbox?</h2>
                
                <div style="text-align: right; line-height: 1.8;">
                    
                    <div style="background: #d1ecf1; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid #0dcaf0;">
                        <h3 style="margin-top: 0; color: #0c5460;">☁️ פרטי האפליקציה</h3>
                        <p style="margin: 8px 0;"><strong>שם אפליקציית Dropbox:</strong> <code style="background: #fff; padding: 3px 8px; border-radius: 4px;">ricuzapp2</code></p>
                        <p style="margin: 8px 0;"><strong>סטטוס:</strong> Development (פיתוח)</p>
                        <p style="margin: 8px 0;"><strong>סוג הרשאות:</strong> Scoped App</p>
                        <p style="margin: 8px 0;"><strong>קישור לניהול:</strong> <a href="https://www.dropbox.com/developers/apps" target="_blank" style="color: #007bff;">Dropbox App Console</a></p>
                    </div>

                    <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-right: 4px solid #ffc107;">
                        <h3 style="margin-top: 0; color: #856404;">🔐 אבטחת ה-Token</h3>
                        <p style="margin: 8px 0;">ה-Access Token שלך נשמר באפליקציה <strong>Password Safe</strong> לשמירה מאובטחת.</p>
                        <p style="margin: 8px 0;"><strong>⚠️ חשוב:</strong> אל תשתף את ה-Token עם אף אחד - הוא מאפשר גישה מלאה לנתונים שלך ב-Dropbox!</p>
                    </div>

                    <h3 style="color: #1f4e79;">✅ הנתונים שנשמרים אוטומטית:</h3>
                    
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #28a745;">💰 נתונים כספיים</h4>
                        <ul style="margin-right: 25px; line-height: 2;">
                            <li>✅ <strong>כל העסקאות</strong> - כל התנועות הכספיות שהזנת</li>
                            <li>✅ <strong>צ'קים מיובאים</strong> - עסקאות שיובאו מקבצי Excel/CSV</li>
                            <li>✅ <strong>יתרות פתיחה</strong> - יתרות התחלתיות לכל חודש ושנה</li>
                            <li>✅ <strong>יתרות ידניות</strong> - יתרות שהגדרת באופן ידני</li>
                        </ul>
                    </div>

                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #007bff;">🗂️ הגדרות ומיפויים</h4>
                        <ul style="margin-right: 25px; line-height: 2;">
                            <li>✅ <strong>מיפויים של קטגוריות</strong> - כל המיפויים בין פריטים לקטגוריות</li>
                            <li>✅ <strong>קטגוריות מותאמות</strong> - קטגוריות שהוספת או ערכת</li>
                            <li>✅ <strong>הערות חודשיות</strong> - הערות שהוספת לחודשים שונים</li>
                        </ul>
                    </div>

                    <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                        <h4 style="margin-top: 0; color: #6c757d;">⚙️ העדפות אישיות</h4>
                        <ul style="margin-right: 25px; line-height: 2;">
                            <li>✅ <strong>חודש ושנה אחרונים</strong> - הבחירות האחרונות שלך</li>
                            <li>✅ <strong>צבע אחרון</strong> - הצבע שבחרת לאחרונה</li>
                            <li>✅ <strong>שנה נוכחית</strong> - השנה שאתה עובד איתה</li>
                        </ul>
                    </div>

                    <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-right: 4px solid #28a745;">
                        <h3 style="margin-top: 0; color: #155724;">📁 היכן הקובץ נשמר?</h3>
                        <p style="margin: 8px 0;">הקובץ נשמר כ-<code style="background: #fff; padding: 3px 8px; border-radius: 4px;">/budget-data.json</code> בתיקייה הראשית של ה-Dropbox שלך.</p>
                        <p style="margin: 8px 0;">אתה יכול להיכנס ל-<a href="https://www.dropbox.com" target="_blank" style="color: #007bff;">Dropbox</a> ולראות את הקובץ.</p>
                    </div>

                    <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-right: 4px solid #0066cc;">
                        <h3 style="margin-top: 0; color: #004085;">🔄 מתי הסנכרון מתרחש?</h3>
                        
                        <p style="margin: 8px 0;"><strong>📤 סנכרון אוטומטי (העלאה):</strong></p>
                        <ul style="margin-right: 25px; line-height: 2;">
                            <li>🔵 בכל פעם שאתה מוסיף/מוחק/מעדכן עסקה</li>
                            <li>🔵 כשאתה משנה מיפוי או קטגוריה</li>
                            <li>🔵 כשאתה מעדכן יתרת פתיחה</li>
                            <li>🔵 כשאתה מוסיף הערה חודשית</li>
                        </ul>
                        
                        <p style="margin: 18px 0 8px 0;"><strong>🔁 סנכרון דו-כיווני (הורדה אוטומטית):</strong></p>
                        <ul style="margin-right: 25px; line-height: 2;">
                            <li>🟢 המערכת בודקת אוטומטית <strong>כל 2 דקות</strong> אם יש עדכונים חדשים</li>
                            <li>🟢 אם מישהו עדכן נתונים במחשב אחר - <strong>תקבל אותם אוטומטית!</strong></li>
                            <li>🟢 לא צריך ללחוץ כלום - הכל קורה ברקע</li>
                            <li>🟢 תראה הודעה "🔄 עדכון חדש התקבל מ-Dropbox!" כשיש עדכון</li>
                        </ul>
                        
                        <div style="background: #d4edda; padding: 12px; border-radius: 6px; margin-top: 15px;">
                            <strong style="color: #155724;">💡 טיפ:</strong> הפעל את שני האפשרויות יחד לסנכרון מושלם!<br>
                            ✅ סנכרון אוטומטי = העלאה מיידית<br>
                            ✅ סנכרון דו-כיווני = הורדה אוטומטית כל 2 דקות
                        </div>
                    </div>

                    <div style="background: #fff; padding: 15px; border-radius: 8px; border: 2px solid #28a745;">
                        <h3 style="margin-top: 0; color: #28a745;">🎯 התוצאה עם סנכרון דו-כיווני</h3>
                        <p style="font-size: 1.1em; margin: 10px 0;"><strong>עובד על 2 מחשבים במקביל? בלי בעיה!</strong></p>
                        <p style="margin: 10px 0;">✨ עדכן עסקה במחשב A → תוך 2 דקות תראה אותה גם במחשב B!</p>
                        <p style="margin: 10px 0;">🚀 זה כמו Google Docs - כולם רואים את אותו הדבר!</p>
                    </div>

                    <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin-top: 20px; border-right: 4px solid #dc3545;">
                        <h3 style="margin-top: 0; color: #721c24;">⚠️ מה לא נשמר?</h3>
                        <p style="margin: 8px 0;">רק דבר אחד לא נשמר: <strong>ה-Dropbox Token עצמו</strong></p>
                        <p style="margin: 8px 0;">בכל מכשיר חדש תצטרך להזין את ה-Token פעם אחת (הוא שמור ב-Password Safe שלך).</p>
                    </div>

                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal handlers
        const closeBtn = modal.querySelector('.close');
        closeBtn.onclick = () => modal.remove();
        
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        };
    }
}

// Initialize Dropbox Sync when the page loads (after BudgetSystem is created)
window.addEventListener('DOMContentLoaded', () => {
    console.log('🔄 Starting Dropbox Sync initialization...');
    
    // Try to initialize immediately if budgetSystem exists
    const tryInitialize = () => {
        if (window.budgetSystem) {
            window.dropboxSync = new DropboxSync(window.budgetSystem);
            console.log('✅ Dropbox Sync initialized successfully!');
            return true;
        }
        return false;
    };
    
    // Try immediately
    if (!tryInitialize()) {
        // If not available, wait and try again
        console.log('⏳ Waiting for BudgetSystem...');
        setTimeout(() => {
            if (!tryInitialize()) {
                console.error('❌ Failed to initialize Dropbox Sync - BudgetSystem not found');
            }
        }, 2000);
    }
});
