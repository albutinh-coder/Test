// ==========================================
// مدير البحث الموحد - ملف منفصل
// ==========================================

/**
 * كائن إدارة البحث
 */
const SearchManager = {
    // حالة البحث
    state: {
        searchActive: false,
        currentSearchQuery: '',
        searchResults: [],
        searchHighlights: []
    },

    /**
     * إجراء بحث
     * @param {string} query - نص البحث
     * @param {Object} appState - حالة التطبيق
     */
    performSearch(query, appState) {
        if (!query || !query.trim()) {
            this.clearSearch(appState);
            return;
        }
        
        this.state.currentSearchQuery = query.trim();
        
        if (appState.currentView === 'users') {
            this.filterUsers(appState);
        } else {
            this.searchContent(appState);
        }
    },

    /**
     * بحث في المحتوى
     * @param {Object} appState - حالة التطبيق
     */
    searchContent(appState) {
        this.state.searchResults = [];
        
        let targetQuestions = [];
        let isContentManagement = appState.contentManagementMode;
        
        if (isContentManagement) {
            if (!appState.currentContentUnit) return;
            targetQuestions = appState.currentContentUnit.questions;
        } else {
            if (!appState.currentUnit) return;
            targetQuestions = appState.currentUnit.type === 'qa-display' ? 
                appState.currentUnit.questions : 
                (appState.currentUnit.filteredQuestions || appState.currentUnit.questions);
        }
        
        const searchTerms = this.state.currentSearchQuery.toLowerCase()
            .split(' ')
            .filter(term => term.length > 0);
        
        targetQuestions.forEach((item, index) => {
            if (item.type === 'header' || item.type === 'note') return;
            
            let relevance = 0;
            const questionText = (item.question || '').toLowerCase();
            const optionsText = (item.options || []).join(' ').toLowerCase();
            const answerText = (String(item.answer) || '').toLowerCase();
            const explanationText = (item.explanation || '').toLowerCase();
            const allContent = `${questionText} ${optionsText} ${answerText} ${explanationText}`;
            
            searchTerms.forEach(term => {
                if (allContent.includes(term)) {
                    relevance += 1;
                    if (questionText.includes(term)) relevance += 2;
                }
            });
            
            if (relevance > 0) {
                this.state.searchResults.push({
                    index: index,
                    relevance: relevance,
                    question: item,
                    isContentManagement: isContentManagement
                });
            }
        });
        
        this.state.searchResults.sort((a, b) => b.relevance - a.relevance);
        this.updateSearchResultsUI(appState);
        this.highlightSearchTerms(appState);
    },

    /**
     * تصفية المستخدمين
     * @param {Object} appState - حالة التطبيق
     */
    filterUsers(appState) {
        // هذه الدالة ستتم معالجتها في ملف إدارة المستخدمين
        console.log('بحث في المستخدمين:', this.state.currentSearchQuery);
        // سوف يتم تنفيذ البحث الفعلي في user-manager.js لاحقاً
        if (typeof window.filterUsers === 'function') {
            window.filterUsers(this.state.currentSearchQuery);
        }
    },

    /**
     * تحديث واجهة نتائج البحث
     * @param {Object} appState - حالة التطبيق
     */
    updateSearchResultsUI(appState) {
        const resultsInfo = document.getElementById('searchResultsInfo');
        const clearBtn = document.getElementById('clearSearchBtn');
        
        if (!resultsInfo || !clearBtn) return;
        
        const isContentManagement = appState.contentManagementMode;
        const containerId = isContentManagement ? 'contentList' : 'questionsList';
        const container = document.getElementById(containerId);
        
        if (!container) return;
        
        const allCards = container.querySelectorAll('.question-card, .qa-concept-card');
        const decorations = container.querySelectorAll(':scope > div:not([id])');
        
        if (this.state.currentSearchQuery.trim() !== "") {
            resultsInfo.classList.remove('hidden');
            clearBtn.classList.remove('hidden');
            
            if (this.state.searchResults.length > 0) {
                resultsInfo.textContent = `تم العثور على ${this.state.searchResults.length} نتيجة لـ "${this.state.currentSearchQuery}"`;
                
                decorations.forEach(el => el.classList.add('hidden'));
                
                allCards.forEach(card => {
                    let numericId = -1;
                    
                    if (isContentManagement) {
                        const cardId = card.id;
                        if (cardId && cardId.startsWith('content-card-')) {
                            numericId = parseInt(cardId.replace('content-card-', ''));
                        }
                    } else {
                        const cardId = card.id;
                        const parts = cardId.split('-');
                        numericId = parseInt(parts[parts.length - 1]);
                    }
                    
                    const isMatch = this.state.searchResults.some(result => 
                        result.index === numericId && 
                        result.isContentManagement === isContentManagement
                    );
                    
                    if (isMatch) {
                        card.classList.remove('hidden');
                        card.classList.add('border-blue-500', 'dark:border-blue-400', 'ring-2', 'ring-blue-100', 'dark:ring-blue-900/30');
                    } else {
                        card.classList.add('hidden');
                        card.classList.remove('border-blue-500', 'dark:border-blue-400', 'ring-2', 'ring-blue-100', 'dark:ring-blue-900/30');
                    }
                });
                
                const firstResult = container.querySelector('.question-card:not(.hidden), .qa-concept-card:not(.hidden)');
                if (firstResult) {
                    const offset = 120;
                    window.scrollTo({
                        top: firstResult.offsetTop - offset,
                        behavior: 'smooth'
                    });
                }
            } else {
                resultsInfo.textContent = `لا توجد نتائج لـ "${this.state.currentSearchQuery}"`;
                allCards.forEach(card => card.classList.add('hidden'));
                decorations.forEach(el => el.classList.add('hidden'));
            }
        } else {
            resultsInfo.classList.add('hidden');
            clearBtn.classList.add('hidden');
            
            allCards.forEach(card => {
                card.classList.remove('hidden', 'border-blue-500', 'dark:border-blue-400', 'ring-2', 'ring-blue-100', 'dark:ring-blue-900/30');
            });
            
            decorations.forEach(el => el.classList.remove('hidden'));
        }
    },

    /**
     * تمييز كلمات البحث
     * @param {Object} appState - حالة التطبيق
     */
    highlightSearchTerms(appState) {
    this.removeSearchHighlights();

    if (!this.state.currentSearchQuery) return;
    
    // تقسيم كلمات البحث
    const terms = this.state.currentSearchQuery.trim().toLowerCase().split(/\s+/).filter(t => t.length > 1);
    if (terms.length === 0) return;

    // دالة داخلية لتنظيف النص من الرموز الخاصة التي تكسر الـ Regex
    const escapeRegExp = (string) => {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    };

    let container;
    if (appState.currentView === 'users') {
        container = document.getElementById('usersTableBody');
    } else if (appState.contentManagementMode) {
        container = document.getElementById('contentList');
    } else {
        container = document.getElementById('questionsList');
    }
    
    if (!container) return;
    
    const contentElements = container.querySelectorAll('td, .question-title, .option-btn span, h4, p, li');
    
    contentElements.forEach(el => {
        let html = el.innerHTML;
        terms.forEach(term => {
            // استخدام الدالة المنظفة هنا
            const safeTerm = escapeRegExp(term);
            const regex = new RegExp(`(${safeTerm})`, 'gi');
            html = html.replace(regex, '<span class="search-highlight">$1</span>');
        });
        el.innerHTML = html;
    });
},


    /**
     * إزالة التمييز من البحث
     */
    removeSearchHighlights() {
        document.querySelectorAll('.search-highlight').forEach(highlight => {
            const parent = highlight.parentNode;
            parent.replaceChild(document.createTextNode(highlight.textContent), highlight);
            parent.normalize();
        });
    },

    /**
     * مسح البحث
     * @param {Object} appState - حالة التطبيق
     */
    clearSearch(appState) {
        this.state.currentSearchQuery = '';
        this.state.searchResults = [];
        
        const searchInput = document.getElementById('smartSearchInput');
        if (searchInput) searchInput.value = '';
        
        document.getElementById('clearSearchBtn')?.classList.add('hidden');
        document.getElementById('searchResultsInfo')?.classList.add('hidden');
        
        this.removeSearchHighlights();
        
        if (appState.currentView === 'users') {
            // إعادة عرض المستخدمين
            if (typeof window.renderUsersTable === 'function') {
                window.renderUsersTable();
            }
        } else if (appState.contentManagementMode) {
            const contentList = document.getElementById('contentList');
            if (contentList) {
                contentList.querySelectorAll('.question-card').forEach(card => {
                    card.classList.remove('hidden', 'border-blue-500', 'dark:border-blue-400', 'ring-2');
                });
            }
        } else {
            this.updateSearchResultsUI(appState);
        }
    },

    /**
     * تبديل حالة البحث
     * @param {Object} appState - حالة التطبيق
     */
    toggleSearch(appState) {
        const searchContainer = document.getElementById('searchContainer');
        const searchToggleText = document.getElementById('searchToggleText');
        const searchInput = document.getElementById('smartSearchInput');
        const unitInfoContainer = document.getElementById('unitInfoContainer');
        
        this.state.searchActive = !this.state.searchActive;
        
        const isMobile = window.innerWidth < 768;
        
        if (this.state.searchActive) {
            searchContainer?.classList.remove('hidden');
            if (searchToggleText) searchToggleText.textContent = 'إخفاء البحث الذكي';
            
            if (isMobile) {
                unitInfoContainer?.classList.add('hidden');
            }
            
            setTimeout(() => searchInput?.focus(), 100);
        } else {
            searchContainer?.classList.add('hidden');
            unitInfoContainer?.classList.remove('hidden');
            
            if (searchToggleText) searchToggleText.textContent = 'تفعيل البحث الذكي';
            this.clearSearch(appState);
        }
        
        // حفظ حالة البحث في التخزين المحلي
        localStorage.setItem('searchActive', this.state.searchActive.toString());
    },

    /**
     * تهيئة البحث
     * @param {Object} appState - حالة التطبيق
     */
    initialize(appState) {
        // تحميل حالة البحث المحفوظة
        const savedSearchState = localStorage.getItem('searchActive');
        this.state.searchActive = savedSearchState === 'true';
        
        // ربط أحداث البحث
        this.bindEvents(appState);
        
        // تحديث الواجهة
        this.updateUI(appState);
    },

    /**
     * ربط أحداث البحث
     * @param {Object} appState - حالة التطبيق
     */
    bindEvents(appState) {
        const searchInput = document.getElementById('smartSearchInput');
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        const toggleSearchBtn = document.getElementById('toggleSearchBtn');
        
        if (!searchInput) return;
        
        // حدث الإدخال
        searchInput.addEventListener('input', (e) => {
            this.performSearch(e.target.value, appState);
        });
        
        // حدث الضغط على Enter
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.performSearch(e.target.value, appState);
            }
        });
        
        // زر مسح البحث
        if (clearSearchBtn) {
            clearSearchBtn.addEventListener('click', () => {
                this.clearSearch(appState);
            });
        }
        
        // زر تبديل البحث
        if (toggleSearchBtn) {
            toggleSearchBtn.addEventListener('click', () => {
                this.toggleSearch(appState);
            });
        }
    },

    /**
     * تحديث واجهة البحث
     * @param {Object} appState - حالة التطبيق
     */
    updateUI(appState) {
        const searchContainer = document.getElementById('searchContainer');
        const unitInfoContainer = document.getElementById('unitInfoContainer');
        const searchToggleText = document.getElementById('searchToggleText');
        const isMobile = window.innerWidth < 768;
        
        if (!searchContainer || !unitInfoContainer) return;
        
        if (this.state.searchActive) {
            searchContainer.classList.remove('hidden');
            if (searchToggleText) searchToggleText.textContent = 'إخفاء البحث الذكي';
            if (isMobile) unitInfoContainer.classList.add('hidden');
        } else {
            searchContainer.classList.add('hidden');
            if (searchToggleText) searchToggleText.textContent = 'تفعيل البحث الذكي';
            unitInfoContainer.classList.remove('hidden');
        }
    },

    /**
     * تحديث حالة البحث
     * @param {Object} appState - حالة التطبيق
     */
    updateSearchState(appState) {
        // تحديث حالة البحث بناءً على عرض التطبيق الحالي
        if (appState.currentView === 'users' || 
            appState.contentManagementMode || 
            appState.currentView === 'questions') {
            
            this.updateUI(appState);
            
            if (this.state.currentSearchQuery && this.state.searchActive) {
                this.performSearch(this.state.currentSearchQuery, appState);
            }
        }
    }
};

// جعل المدير متاحاً عالمياً
window.SearchManager = SearchManager;