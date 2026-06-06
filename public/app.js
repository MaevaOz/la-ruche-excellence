document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/content');
        if (!response.ok) throw new Error('API response was not ok');
        const data = await response.json();
        
        // Structure les données pour la page produit détaillée (ex: /products/3)
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts[0] === 'products' && pathParts[1]) {
            const currentUrl = `/products/${pathParts[1]}`;
            const currentProduct = data.portfolio?.items?.find(item => item.url === currentUrl);
            if (currentProduct) {
                // Permet d'appeler directement data-content="currentProduct.name"
                data.currentProduct = currentProduct;
            }
        }
        
        // 1. Initialise les balises de listes (tableaux JSON -> templates HTML)
        mapLists(document, data);

        // 2. Initialise les attributs (data-attr="src:image.png")
        mapAttributes(document, data);

        // 3. Initialise le contenu (data-content="meta.title")
        mapContent(document, data);

        // 4. Inject GDPR Banner globally
        if (!document.getElementById('cookie-banner') && !localStorage.getItem('cookieConsent')) {
            const banner = document.createElement('div');
            banner.id = 'cookie-banner';
            banner.style.cssText = 'position: fixed; bottom: 0; left: 0; width: 100%; background-color: var(--bleu-abyssal); color: var(--blanc-celeste); padding: 1.5rem 5%; display: flex; justify-content: space-between; align-items: center; z-index: 9999; border-top: 2px solid var(--vieil-or); flex-wrap: wrap; gap: 1rem; box-shadow: 0 -10px 40px rgba(0,0,0,0.3);';
            banner.innerHTML = `
                <div data-content="cookie_banner.text_html" style="font-size: 0.9rem; max-width: 800px; opacity: 0.9;"></div>
                <div style="display: flex; gap: 1rem;">
                    <button id="btn-cookie-accept" data-content="cookie_banner.btn_accept" style="background-color: var(--vieil-or); color: var(--bleu-abyssal); border: none; padding: 0.75rem 1.5rem; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; cursor: pointer;"></button>
                    <button id="btn-cookie-decline" data-content="cookie_banner.btn_decline" style="background-color: transparent; color: var(--blanc-celeste); border: 1px solid rgba(255,255,255,0.3); padding: 0.75rem 1.5rem; font-weight: 600; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.1em; cursor: pointer;"></button>
                </div>`;
            document.body.appendChild(banner);
            mapContent(banner, data);
        }

        const firstTab = document.querySelector('.filter-tab');
        if (firstTab) {
            firstTab.classList.add('active');
        }

    } catch (error) {
        console.error('Erreur Critique : Impossible de charger les données du CMS', error);
    }
});

/**
 * Permet d'extraire de manière sécurisée une valeur dans un objet imbriqué
 * Supporte : "nav.logo.text_principal" ainsi que "about.paragraphs[0]"
 */
function getNestedValue(obj, path) {
    if (!path) return undefined;
    return path.split('.').reduce((acc, part) => {
        const match = part.match(/([^\[]+)\[(\d+)\]/);
        if (match) {
            const key = match[1];
            const index = match[2];
            return acc && acc[key] ? acc[key][index] : undefined;
        }
        return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
}

function mapContent(fragment, data) {
    const elements = fragment.querySelectorAll ? fragment.querySelectorAll('[data-content]:not([data-list] *)') : [];
    
    const applyContent = (el) => {
        const path = el.getAttribute('data-content');
        const value = getNestedValue(data, path);
        if (value !== undefined) {
            if (path.includes('_html')) {
                el.innerHTML = value;
            } else {
                el.textContent = value;
            }
        }
    };

    elements.forEach(applyContent);
    if (fragment.nodeType === 1 && fragment.getAttribute('data-content')) {
        applyContent(fragment);
    }
}

function mapAttributes(fragment, data) {
    const elements = fragment.querySelectorAll ? fragment.querySelectorAll('[data-attr]:not([data-list] *)') : [];
    
    const applyAttributes = (el) => {
        const attrConfig = el.getAttribute('data-attr');
        if (attrConfig) {
            const rules = attrConfig.split(',');
            rules.forEach(rule => {
                const [attrName, path] = rule.split(':');
                if (attrName && path) {
                    const value = getNestedValue(data, path.trim());
                    if (value !== undefined) {
                        el.setAttribute(attrName.trim(), value);
                    }
                }
            });
        }
    };

    elements.forEach(applyAttributes);
    if (fragment.nodeType === 1 && fragment.getAttribute('data-attr')) {
        applyAttributes(fragment);
    }
}

function mapLists(fragment, data) {
    const listContainers = fragment.querySelectorAll ? fragment.querySelectorAll('[data-list]') : [];
    
    listContainers.forEach(container => {
        const listPath = container.getAttribute('data-list');
        const itemName = container.getAttribute('data-item') || 'item';
        const listData = getNestedValue(data, listPath);
        
        if (Array.isArray(listData)) {
            const template = container.querySelector('template');
            if (template) {
                container.innerHTML = '';
                container.appendChild(template);
                
                listData.forEach((itemData, index) => {
                    const clone = template.content.cloneNode(true);
                    const contextData = { ...data, [itemName]: itemData };
                    
                    mapLists(clone, contextData);
                    mapAttributes(clone, contextData);
                    mapContent(clone, contextData);
                    
                    container.appendChild(clone);
                });
            }
        }
    });
}

function applyFilters() {
    const searchInput = document.querySelector('.search-input');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const activeTab = document.querySelector('.filter-tab.active');
    const filterText = activeTab ? activeTab.textContent.trim().toLowerCase() : '';
    
    const cards = document.querySelectorAll('.card');
    cards.forEach(card => {
        const title = card.querySelector('h3')?.textContent.toLowerCase() || '';
        const desc = card.querySelector('p')?.textContent.toLowerCase() || '';
        const badge = card.querySelector('.badge');
        const sector = badge ? badge.textContent.trim().toLowerCase() : '';
        
        const categoryMatch = filterText === '' || filterText.includes('tous') || filterText.includes('toute') || sector === filterText;
        const searchMatch = searchTerm === '' || title.includes(searchTerm) || desc.includes(searchTerm) || sector.includes(searchTerm);
        
        if (categoryMatch && searchMatch) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

document.addEventListener('input', (e) => {
    if (e.target.matches('.search-input')) {
        applyFilters();
    }
});

// --- Interactivité UI/UX globale (Event Delegation) ---
document.addEventListener('click', (e) => {
    // 1. Filtres du catalogue (Boutons .filter-tab)
    if (e.target.matches('.filter-tab')) {
        document.querySelectorAll('.filter-tab').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        applyFilters();
    }

    // 2. Onglets locaux de la fiche produit (Boutons .local-tab-btn)
    if (e.target.matches('.local-tab-btn')) {
        const tabBtn = e.target;
        const tabsNav = tabBtn.closest('.local-tabs-nav');
        if (!tabsNav) return;
        
        const allTabs = Array.from(tabsNav.querySelectorAll('.local-tab-btn'));
        const index = allTabs.indexOf(tabBtn);
        
        allTabs.forEach(btn => btn.classList.remove('active'));
        tabBtn.classList.add('active');
        
        const tabsContainer = tabsNav.parentElement;
        if (tabsContainer) {
            const tabContents = tabsContainer.querySelectorAll('.tab-content');
            tabContents.forEach((content, i) => {
                if (i === index) {
                    content.style.display = '';
                } else {
                    content.style.display = 'none';
                }
            });
        }
    }

    // 3. MISE À JOUR : Gestion Premium de la Fenêtre de Souscription
    // Ouverture (Soit via le bouton classique, soit via le nouvel ID de la colonne latérale)
    if (e.target.closest('.btn-subscribe') || e.target.id === 'open-subscription-modal') {
        const modal = document.getElementById('subscription-modal');
        if (modal) {
            e.preventDefault();
            modal.style.display = 'flex';
        }
    }

    // Fermeture (Via la croix, le bouton annuler, ou un clic sur le fond transparent de la modal)
    if (
        e.target.id === 'close-subscription-modal' || 
        e.target.id === 'cancel-subscription' || 
        e.target === document.getElementById('subscription-modal') ||
        e.target.closest('.modal-close') || 
        e.target.closest('.btn-cancel')
    ) {
        const modal = document.getElementById('subscription-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 4. Consentement Cookies
    if (e.target.closest('#btn-cookie-accept') || e.target.closest('#btn-cookie-decline')) {
        localStorage.setItem('cookieConsent', 'true');
        const banner = document.getElementById('cookie-banner');
        if (banner) banner.style.display = 'none';
    }
});