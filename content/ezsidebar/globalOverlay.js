// static class "EzSidebarService" 
var EzSidebarService =
{
	activated       : false,
	initialized     : false,
	windowIsClosing : false,

	lastState : window.windowState,

	sidebarHeight : 0,
	autoCollapse  : false,
	
	// 定数 
	XULNS : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
	PREFROOT : 'extensions.{0EAF175C-0C46-4932-AB7D-F45D6C46F367}',
 
	// プロパティ 
	// properties
	
	get panels() 
	{
		var panels = this.getPref('ezsidebar.panels');
		try {
			if (panels) return Array.slice(this.evalInSandbox(panels));
		}
		catch(e) {
		}
		return [];
	},
	set panels(aValue)
	{
		this.setPref('ezsidebar.panels', uneval(aValue || []));
		return aValue;
	},
 
	get staticPanels() 
	{
		var panels = this.getPref('ezsidebar.staticPanels');
		try {
			if (panels) return Array.slice(this.evalInSandbox(panels));
		}
		catch(e) {
		}
		return [];
	},
	set staticPanels(aValue)
	{
		this.setPref('ezsidebar.staticPanels', uneval(aValue || []));
		return aValue;
	},
 
	get strbundle() 
	{
		if (!this._strbundle) {
			const STRBUNDLE = Components.classes['@mozilla.org/intl/stringbundle;1'].getService(Components.interfaces.nsIStringBundleService);
			this._strbundle = STRBUNDLE.createBundle('chrome://ezsidebar/locale/ezsidebar.properties');
		}
		return this._strbundle;
	},
	_strbundle : null,
 
	get browserURI() 
	{
		if (!this._browserURI) {
			var uri = this.getPref('browser.chromeURL');
			if (!uri) {
				try {
					var handler = Components.classes['@mozilla.org/commandlinehandler/general-startup;1?type=browser'].getService(Components.interfaces.nsICmdLineHandler);
					uri = handler.chromeUrlForTask;
				}
				catch(e) {
				}
			}
			if (uri.charAt(uri.length-1) == '/')
				uri = uri.replace(/chrome:\/\/([^\/]+)\/content\//, 'chrome://$1/content/$1.xul');
			this._browserURI = uri;
		}
		return this._browserURI;
	},
	_browserURI : null,
 
	// window 
	
	get hostWindow() 
	{
		return this.getTopWindowOf('navigator:browser');
	},
 
	get hostWindows() 
	{
		return this.getWindowsOf('navigator:browser');
	},
 
	get sidebarWindow() 
	{
		return this.getTopWindowOf('mozilla:sidebar');
	},
 
	get sidebarWindows() 
	{
		return this.getWindowsOf('mozilla:sidebar');
	},
  
	// element 
	
	get sidebarBox() 
	{
		if (!('_sidebarBox' in this) || this._sidebarBox === void(0)) {
			this._sidebarBox = document.getElementById('sidebar-box');
		}
		return this._sidebarBox;
	},
//	_sidebarBox : null,
 
	get sidebarSplitter() 
	{
		if (!('_sidebarSplitter' in this) || this._sidebarSplitter === void(0)) {
			this._sidebarSplitter = document.getElementById('sidebar-splitter');
		}
		return this._sidebarSplitter;
	},
//	_sidebarSplitter : null,
 
	get sidebarTitle() 
	{
		return document.getElementById('sidebar-title');
	},
 
	get sidebarHeader() 
	{
		if (!('_sidebarHeader' in this) || this._sidebarHeader === void(0)) {
			var nodes = this.sidebarBox.getElementsByTagName('sidebarheader');
			this._sidebarHeader = nodes.length ? nodes[0] : null ;
		}
		return this._sidebarHeader;
	},
//	_sidebarHeader : null,
 
	get sidebar() 
	{
		return this._currentSidebar;
	},
	set sidebar(aSidebar)
	{
		this._currentSidebar = aSidebar;
		if (!this._currentSidebar ||
			this._currentSidebar.localName != 'browser')
			this._currentSidebar = this.isCurrentUserDefined ? this.userSidebar : this.staticSidebar ;
	},
	_currentSidebar : null,
 
	get sidebarCollapsed() 
	{
		return this.sidebar == this.userSidebar ? this.sidebar.parentNode.collapsed : this.staticSidebar.collapsed ;
	},
	set sidebarCollapsed(aCollapsed)
	{
		if (this.sidebar == this.userSidebar) // "collapsed" attribute breaks browser's history.
			this.sidebar.parentNode.collapsed = aCollapsed;
		else
			this.staticSidebar.collapsed = aCollapsed;

		return this.sidebarCollapsed;
	},
 
	get staticSidebar() 
	{
		if (!('_staticSidebar' in this) || this._staticSidebar === void(0)) {
			this._staticSidebar = document.getElementById('sidebar');
		}
		return this._staticSidebar;
	},
//	_staticSidebar : null,
 
	get userSidebar() 
	{
		if (!('_userSidebar' in this) || this._userSidebar === void(0)) {
			this._userSidebar = document.getElementById('sidebar-userdefined');
		}
		return this._userSidebar;
	},
//	_userSidebar : null,
 
	get panelsPopup() 
	{
		if (!this._panelsPopup)
			this._panelsPopup = document.getElementById('ezsidebar-toggle-button:contextmenu');
		return this._panelsPopup;
	},
	_panelsPopup : null,
  
	get currentPanel() 
	{
		return (!this.isUndocked || this.isSidebarWindow ? this.sidebarBox.getAttribute('sidebarcommand') : null) || this.getPref('ezsidebar.lastCommand') || 'viewBookmarksSidebar' ;
	},
 
	get lastPanel() 
	{
		return this.getPref('ezsidebar.lastCommand') || 'viewBookmarksSidebar' ;
	},
 
	get isCurrentUserDefined() 
	{
		return this.isUserDefined(this.currentPanel);
	},
 
	get isSidebarWindow() 
	{
		return document.documentElement.getAttribute('windowtype') == 'mozilla:sidebar';
	},
 
	get isUndocked() 
	{
		return this.getPref('ezsidebar.independent');
	},
 
	getDocShellFromDocument : function(aDocument, aRootDocShell) 
	{
		var doc = aDocument;
		if (!doc) return null;

		const kDSTreeNode = Components.interfaces.nsIDocShellTreeNode;
		const kDSTreeItem = Components.interfaces.nsIDocShellTreeItem;
		const kWebNav     = Components.interfaces.nsIWebNavigation;

		if (doc.defaultView)
			return doc.defaultView
					.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
					.getInterface(kWebNav)
					.QueryInterface(Components.interfaces.nsIDocShell);

		if (!aRootDocShell)
			aRootDocShell = window.gBrowser.docShell;

		aRootDocShell = aRootDocShell
				.QueryInterface(kDSTreeNode)
				.QueryInterface(kDSTreeItem)
				.QueryInterface(kWebNav);
		var docShell = aRootDocShell;
		traceDocShellTree:
		do {
			if (docShell.document == aDocument)
				return docShell;

			if (docShell.childCount) {
				docShell = docShell.getChildAt(0);
				docShell = docShell
					.QueryInterface(kDSTreeNode)
					.QueryInterface(kWebNav);
			}
			else {
				parentDocShell = docShell.parent.QueryInterface(kDSTreeNode);
				while (docShell.childOffset == parentDocShell.childCount-1)
				{
					docShell = parentDocShell;
					if (docShell == aRootDocShell || !docShell.parent)
						break traceDocShellTree;
					parentDocShell = docShell.parent.QueryInterface(kDSTreeNode);
				}
				docShell = parentDocShell.getChildAt(docShell.childOffset+1)
					.QueryInterface(kDSTreeNode)
					.QueryInterface(kWebNav);
			}
		} while (docShell != aRootDocShell);

		return null;
	},
  
	// observers and listeners 
	
	observe : function(aSubject, aTopic, aData) 
	{
		switch(aTopic)
		{
			case 'toggleSidebar':
				if (!aData) return;
		//			if (aSubject == window) return;
		//			alert('CURRENT : '+location.href+'\nFROM : '+aSubject.location.href);
				var newChecked = aData.split('\n')[1] == 'true';
				var node  = window.document.getElementById(aData.split('\n')[0]);
				var nodes = window.document.getElementsByAttribute('group', 'sidebar');

				if (node) {
					if (newChecked)
						node.setAttribute('checked', true);
					else
						node.removeAttribute('checked');
				}
				for (var i = 0; i < nodes.length; i++)
					if (nodes[i] != node &&
						nodes[i].getAttribute('observes') != node.id)
						nodes[i].removeAttribute('checked');
				break;

			case 'sidebarWindowHidden':
				this.sidebarBox.setAttribute('sidebarcommand', '');
				this.processingToShowSidebarWindow = false;
				break;

			case 'sidebarWindowCompletelyShown':
				this.sidebarBox.setAttribute('sidebarcommand', this.currentPanel);
				this.processingToShowSidebarWindow = false;
				break;

			case 'nsPref:changed':
				if (aData == 'ezsidebar.panels') {
					this.rebuildWithDelay();
				}
				break;

			default:
				break;
		}
	},
	// for pref listener
	domain : 'ezsidebar.',
 
	sidebarProgressListener : function() 
	{
		return ({
		onProgressChange : function(aWebProgress, aRequest, aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress)
		{
//			dump([aCurSelfProgress, aMaxSelfProgress, aCurTotalProgress, aMaxTotalProgress].join(' : ')+'\n');
			if (aMaxTotalProgress < 1 || !this.isUserSidebar) return;

			var percentage = parseInt((aCurTotalProgress * 100) / aMaxTotalProgress);
			if (percentage > 0 && percentage < 100) {
				this.progressmeter.firstChild.setAttribute('value', percentage);
				this.progressmeter.removeAttribute('collapsed');
			}
			else {
				this.progressmeter.firstChild.removeAttribute('value');
				this.progressmeter.setAttribute('collapsed', true);
			}
		},

		get progressmeter()
		{
			if (!this._progressmeter) {
				this._progressmeter = document.getElementById('sidebar-progressmeter-box');
			}
			return this._progressmeter;
		},
		_progressmeter : null,

		get isUserSidebar()
		{
			return EzSidebarService.sidebar == EzSidebarService.userSidebar;
		},

		onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus) {},
		onLocationChange : function(aWebProgress, aRequest, aLocation) {},
		onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage) {},
		onSecurityChange : function(aWebProgress, aRequest, aState) {},
		onLinkIconAvailable : function(aHref) {},

		QueryInterface : function(aIID)
		{
			if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
				aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
				aIID.equals(Components.interfaces.nsISupports))
				return this;
			throw Components.results.NS_NOINTERFACE;
		}
		});
	},
 
	initProgressListener : function(aSidebar) 
	{
		const nsIWebProgress = Components.interfaces.nsIWebProgress;
		const flag = nsIWebProgress.NOTIFY_ALL;
		aSidebar.sidebarProgressListener = this.sidebarProgressListener();
		aSidebar.sidebarProgressFilter = Components.classes['@mozilla.org/appshell/component/browser-status-filter;1'].createInstance(nsIWebProgress);
		aSidebar.addProgressListener(aSidebar.sidebarProgressFilter, flag);
		aSidebar.sidebarProgressFilter.addProgressListener(aSidebar.sidebarProgressListener, flag);
	},
  
	// XPConnect 
	
	get Prefs() 
	{
		if (!this._Prefs) {
			this._Prefs = Components.classes['@mozilla.org/preferences;1'].getService(Components.interfaces.nsIPrefBranch);
		}
		return this._Prefs;
	},
	_Prefs : null,
 
	get IOService() 
	{
		if (!this._IOService) {
			this._IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
		}
		return this._IOService;
	},
	_IOService : null,
 
	get ObserverService() 
	{
		if (!this._ObserverService) {
			this._ObserverService = Components.classes['@mozilla.org/observer-service;1'].getService(Components.interfaces.nsIObserverService);
		}
		return this._ObserverService;
	},
	_ObserverService : null,
 
	get WindowManager() 
	{
		if (!this._WindowManager) {
			if ('@mozilla.org/appshell/window-mediator;1' in Components.classes)
				this._WindowManager = Components.classes['@mozilla.org/appshell/window-mediator;1'].getService(Components.interfaces.nsIWindowMediator);
			else
				this._WindowManager = Components.classes['@mozilla.org/rdf/datasource;1?name=window-mediator'].getService(Components.interfaces.nsIWindowMediator);
		}
		return this._WindowManager;
	},
	_WindowManager : null,
 
	get PromptService() 
	{
		if (!this.mPromptService)
			this.mPromptService = Components.classes['@mozilla.org/embedcomp/prompt-service;1'].getService(Components.interfaces.nsIPromptService);
		return this.mPromptService;
	},
	mPromptService : null,
  
	// common functions 
	
	getInnerTextOf : function(aNode) 
	{
		if (!aNode || !aNode.firstChild) return '';
		var node = aNode.firstChild;

		var depth = 1,
			ret   = [];

		traceTree:
		while (node && depth > 0) {
			if (node.hasChildNodes()) {
				node = node.firstChild;
				depth++;
			} else {
				if (node.nodeType == Node.TEXT_NODE)
					ret.push(node.nodeValue);
				else if (node.alt)
					ret.push(node.alt);

				while (!node.nextSibling) {
					node = node.parentNode;
					depth--;
					if (!node) break traceTree;
				}
				node = node.nextSibling;
			}
		}
		return ret.join('');
	},
 
	getURLSpecFromFile : function(aFileOrPath) 
	{
		try {
			aFileOrPath = aFileOrPath.QueryInterface(Components.interfaces.nsILocalFile);
		}
		catch(e) {
			var tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
			tempLocalFile.initWithPath(aFileOrPath);
			aFileOrPath = tempLocalFile;
		}

		try {
			return this.IOService.newFileURI(aFileOrPath).spec;
		}
		catch(e) { // [[interchangeability for Mozilla 1.1]]
			return this.IOService.getURLSpecFromFile(aFileOrPath);
		}
	},
 
	isUserDefined : function(aID) 
	{
		return aID.match(/^ezsidebar:/) ? true : false ;
	},
 
	getTopWindowOf : function(aWindowType) 
	{
		return this.WindowManager.getMostRecentWindow(aWindowType) || null ;
	},
	
	getWindowsOf : function(aWindowType) 
	{
		var targetWindows = [];
		var targets = this.WindowManager.getEnumerator(aWindowType, true),
			target;
		while (targets.hasMoreElements())
		{
			target = targets.getNext().QueryInterface(Components.interfaces.nsIDOMWindowInternal);
			targetWindows.push(target);
		}

		return targetWindows;
	},
  
	showSidebarWindow : function(aCommand, aWebPanelTitle, aWebPanelURI) 
	{
		var sidebarWindow = this.sidebarWindow;
		if (sidebarWindow) return sidebarWindow;

		if (this.processingToShowSidebarWindow)
			return null;

		this.processingToShowSidebarWindow = true;
		sidebarWindow = window.openDialog('chrome://ezsidebar/content/ezsidebar.xul', '_blank', 'chrome,all,dialog=no' + (this.getPref('ezsidebar.alwaysRaised') ? ',alwaysRaised' : ''), aCommand, aWebPanelTitle, aWebPanelURI);

		return sidebarWindow;
	},
	processingToShowSidebarWindow : false,
 
	hidePopup : function(aNode) 
	{
		var node = aNode;
		if (aNode.localName == 'menuitem') node = node.parentNode;
		while (node &&
				(node.localName == 'menupopup' || node.localName == 'popup'))
		{
			node.hidePopup();
			node = node.parentNode.parentNode;
		}
	},
  
	// update UIs 
	
	rebuild : function() 
	{
		var i;

		var popup = document.getElementById('viewSidebarMenu');
		for (i = popup.childNodes.length-1; i > -1 ; i--)
			if (popup.childNodes[i].getAttribute('ezsidebar-item'))
				popup.removeChild(popup.childNodes[i]);

		// rebuild and reset id
		var nsIXULTemplateBuilderAvailable = this.getPref('ezsidebar.enable.nsIXULTemplateBuilder');

		var containers = [
				document.getElementById('ezsidebarBroadcasterSet'),
				document.getElementById('ezsidebarKeySet'),
				document.getElementById('ezsidebar:viewSidebarMenu:mpopup')
			],
			j,
			node,
			nodes = [];
		for (i = 0; i < containers.length; i++)
		{
			if (!containers[i]) continue;

			this.rebuildFromTemplate(containers[i]);

			for (j = 0; j < containers[i].childNodes.length; j++)
			{
				node = containers[i].childNodes[j];
				if (!node.getAttribute('ezsidebar-generated')) continue;

				node.id = node.getAttribute('ezsidebar-id') || '';
				nodes.push(node);
			}
		}

		// reset key and observs
		var sep;
		for (i in nodes)
		{
			if (nodes[i].getAttribute('ezsidebar-key'))
				nodes[i].setAttribute('key', nodes[i].getAttribute('ezsidebar-key'));
			if (nodes[i].getAttribute('ezsidebar-observes'))
				nodes[i].setAttribute('observes', nodes[i].getAttribute('ezsidebar-observes'));

			if (nodes[i].localName == 'menuitem') {
				if (!popup.lastChild.getAttribute('ezsidebar-item')) {
					sep = document.createElement('menuseparator')
					sep.setAttribute('ezsidebar-item', true);
					popup.appendChild(sep);
				}
				popup.appendChild(nodes[i].cloneNode(true));
			}
		}

		for (i = 0; i < containers[2].nextSibling.childNodes.length; i++)
			popup.appendChild(containers[2].nextSibling.childNodes[i].cloneNode(true));
	},
	rebuildWithDelay : function()
	{
		if (this._rebuildTimer)
			window.clearTimeout(this._rebuildTimer);

		this._rebuildTimer = window.setTimeout(function(aSelf) {
			aSelf._rebuildTimer = null;
			aSelf.rebuild();
		}, 100, this);
	},
	_rebuildTimer : null,
	
	rebuildFromTemplate : function(aContainer) 
	{
		if (!aContainer.hasAttribute('ezsidebar-template')) return;

		if (!('ezsidebarTemplate' in aContainer))
			aContainer.ezsidebarTemplate = this.evalInSandbox(aContainer.getAttribute('ezsidebar-template'));

		var children = aContainer.childNodes;
		for (var i = children.length-1; i > -1; i--)
			if ('ezsidebarGenerated' in children[i] &&
				children[i].ezsidebarGenerated)
				aContainer.removeChild(children[i]);

		this.panels.forEach(function(aPanel) {
			var data = aContainer.ezsidebarTemplate(aPanel, this.currentPanel == 'ezsidebar:broadcaster:'+aPanel.uri);
			if (!data || !('localName' in data)) return;

			aContainer.appendChild(document.createElement(data.localName));
			for (var i in data.attr)
				aContainer.lastChild.setAttribute(i, data.attr[i]);

			aContainer.lastChild.ezsidebarGenerated = true;
		}, this);
	},
	evalInSandbox : function(aCode, aOwner)
	{
		try {
			var sandbox = new Components.utils.Sandbox(aOwner || 'about:blank');
			return Components.utils.evalInSandbox(aCode, sandbox);
		}
		catch(e) {
		}
		return void(0);
	},
  
	initPopup : function(aPopup, aType) 
	{
		var broadcaster = document.getElementById('ezsidebar:broadcaster:isUserDefined');
		if (this.isCurrentUserDefined)
			broadcaster.removeAttribute('disabled');
		else
			broadcaster.setAttribute('disabled', true);

		// copy items
		if (aPopup.hasChildNodes())
			while (aPopup.firstChild.getAttribute('ezsidebar-generated'))
				aPopup.removeChild(aPopup.firstChild);

		if (aType != 'panels' && !aPopup.boxObject.parentBox) {
			aPopup.setAttribute('ezsidebar-menuType', 'contextmenu');
		}
		else {
			aPopup.setAttribute('ezsidebar-menuType', 'panelsmenu');

			var sep = aPopup.getElementsByAttribute('ezsidebar-id', 'sidebarPanelPopup:separator')[0];
			var popup = document.getElementById('viewSidebarMenu'),
				item;
			var panelIndex = (this.currentPanel == 'viewWebPanelsSidebar') ? 1 : 0 ;
			for (i = 0; i < popup.childNodes.length; i++)
			{
				if (popup.childNodes[i].getAttribute('ezsidebar-menubar-item'))
					continue;

				item = popup.childNodes[i].cloneNode(true);
				item.id = '';
				if (item.localName == 'menuitem')
					item.setAttribute('ezsidebar-panel-index', panelIndex++);
				item.setAttribute('ezsidebar-generated', true);
				aPopup.insertBefore(item, sep);
			}

			// create/delete Web Panels item
			if (this.currentPanel == 'viewWebPanelsSidebar') {
				if (aPopup.firstChild.getAttribute('ezsidebar-id') != 'viewWebPanelsSidebar') {
					aPopup.insertBefore(document.createElement('menuseparator'), aPopup.firstChild);
					aPopup.firstChild.setAttribute('ezsidebar-item', true);
					aPopup.firstChild.setAttribute('ezsidebar-generated', true);
					aPopup.insertBefore(document.createElement('menuitem'), aPopup.firstChild);
					aPopup.firstChild.setAttribute('crop', 'end');
					aPopup.firstChild.setAttribute('oncommand', 'document.getElementById(\'sidebar\').reload();');
					aPopup.firstChild.setAttribute('type', 'checkbox');
					aPopup.firstChild.setAttribute('ezsidebar-item', true);
					aPopup.firstChild.setAttribute('ezsidebar-generated', true);
					aPopup.firstChild.setAttribute('ezsidebar-id', 'viewWebPanelsSidebar');
					aPopup.firstChild.setAttribute('ezsidebar-panel-index', 0);
				}
				if (aPopup.firstChild.getAttribute('ezsidebar-id') == 'viewWebPanelsSidebar') {
					aPopup.firstChild.setAttribute('label', this.sidebarTitle.getAttribute('value'));
					aPopup.firstChild.setAttribute('checked', true);
				}
			}
			else {
				if (aPopup.firstChild.getAttribute('ezsidebar-id') == 'viewWebPanelsSidebar') {
					aPopup.removeChild(aPopup.firstChild);
					aPopup.removeChild(aPopup.firstChild);
				}
			}
		}


		if (this.isCurrentUserDefined) {
			var clearKey = aPopup.getElementsByAttribute('ezsidebar-id', aPopup.getAttribute('ezsidebar-menuType') == 'contextmenu' ? 'sidebarPanelPopup:clearKey' : 'sidebarPanelPopup:clearKey:submenu' )[0];
			var keyId = this.sidebarBox.getAttribute('sidebarcommand').replace(/^ezsidebar:broadcaster:/, 'ezsidebar:key:');
			if (clearKey) {
				if (document.getElementById(keyId))
					clearKey.removeAttribute('disabled');
				else
					clearKey.setAttribute('disabled', true);
			}
		}

		aPopup.setAttribute('sidebarcollapsed', this.sidebar.collapsed ? true : false );
	},
 
	// gContextMenu.initItems 
	initItems : function()
	{
		this.__ezsidebar__initItems();

		this.showItem('context-addSidebarPanel', !(this.inDirList || this.isTextSelected || this.onTextInput || this.onLink));
		this.showItem('context-addLinkSidebarPanel', this.onLink && !this.onMailtoLink);
	},
 
	updateTitlebar : function() 
	{
		if (!this.isSidebarWindow) return;

		var newTitle = '';
		var docTitle = this.sidebarTitle.getAttribute('value') || '' ;
		var modifier = document.documentElement.getAttribute('titlemodifier');
		if (docTitle) {
			newTitle += docTitle;
			var sep = document.documentElement.getAttribute('titlemenuseparator');
			if (modifier) newTitle += sep;
		}
		newTitle += modifier;
		window.title = newTitle;
	},
  
// select panel from popup 
	
	onKeyDown : function(aEvent) 
	{
		if ((!aEvent.altKey || aEvent.shiftKey) &&
			EzSidebarService.panelsPopup.shown)
			EzSidebarService.showHidePanelsPopup(false);
	},
 
	onKeyRelease : function(aEvent) 
	{
		if (!EzSidebarService.getPref('ezsidebar.shortcut.switchSidebarPanel.enabled'))
			return;

		var scrollDown,
			scrollUp;

		var standBy = scrollDown = scrollUp = (!aEvent.ctrlKey && !aEvent.metaKey && !aEvent.shiftKey && aEvent.altKey);

		scrollDown = scrollDown && (aEvent.keyCode == aEvent.DOM_VK_PAGE_DOWN);
		scrollUp   = scrollUp && (aEvent.keyCode == aEvent.DOM_VK_PAGE_UP);

		if (scrollDown || scrollUp) {
			EzSidebarService.showHidePanelsPopup(true);
			if (aEvent.type == 'keypress') {
				aEvent.preventBubble();
				aEvent.preventDefault();
				aEvent.stopPropagation();
				EzSidebarService.scrollUpDown(scrollDown ? 1 : -1 );
			}

			return;
		}

		if (EzSidebarService.panelsPopup.shown)
			EzSidebarService.showHidePanelsPopup(false);
	},
 
	showHidePanelsPopup : function(aShow) 
	{
		var popup = this.panelsPopup;
		if (!popup) return;

		if (!aShow) {
			toggleSidebar(popup.getElementsByAttribute('ezsidebar-panel-index', popup.currentIndex)[0].getAttribute('ezsidebar-id'));

			popup.hidePopup();
			popup.currentIndex = 0;

			popup.shown = false;

			return;
		}


		if (popup.shown) return;


		this.initPopup(popup, 'panels');


		var x, y, target;
		if (this.sidebarWindow) {
			target = this.sidebarWindow.document.getElementById('ezsidebar-panels-button');
			x = target.boxObject.screenX;
			y = target.boxObject.screenY+target.boxObject.height;
			if (!x && !y) {
				x = this.sidebarWindow.screenX;
				y = this.sidebarWindow.screenY+target.boxObject.height;
			}
		}
		else if (!this.isUndocked && this.getPref('ezsidebar.show')) {
			target = document.getElementById('ezsidebar-panels-button');
			x = target.boxObject.screenX;
			y = target.boxObject.screenY+target.boxObject.height;
		}
		else if (document.getElementById('ezsidebar-toggle-button')) {
			target = document.getElementById('ezsidebar-toggle-button');
			x = target.boxObject.screenX;
			y = target.boxObject.screenY+target.boxObject.height;
		}
		else {
			x = window.screenX+16;
			y = window.screenY+16;
		}

		popup.autoPosition = true;
		popup.showPopup(
			target ? target : popup.parentNode,
			x,
			y,
			'popup',
			null,
			null
		);

		var found = false;
		for (var i = 0; i < popup.childNodes.length; i++)
			if (popup.childNodes[i].localName == 'menuitem' &&
				popup.childNodes[i].getAttribute('ezsidebar-id') == this.currentPanel) {
				popup.currentIndex = parseInt(popup.childNodes[i].getAttribute('ezsidebar-panel-index'));
				found = true;
				break;
			}

		if (!found) popup.currentIndex = 0;

		popup.getElementsByAttribute('ezsidebar-panel-index', popup.currentIndex)[0].setAttribute('_moz-menuactive', true);

		popup.shown = true;
	},
 
	scrollUpDown : function(aDir) 
	{
		var popup = this.panelsPopup;
		if (!popup) return;

		popup.getElementsByAttribute('ezsidebar-panel-index', popup.currentIndex)[0].removeAttribute('_moz-menuactive');

		var max = popup.getElementsByAttribute('ezsidebar-panel-index', '*').length;
		if (aDir < 0)
			popup.currentIndex = (popup.currentIndex - 1 + max) % max;
		else
			popup.currentIndex = (popup.currentIndex + 1) % max;

		popup.getElementsByAttribute('ezsidebar-panel-index', popup.currentIndex)[0].setAttribute('_moz-menuactive', true);

		try {
			var scrollBox = document.getAnonymousElementByAttribute(popup, 'class', 'popup-internal-box');
			if (!('mScrollBoxObject' in scrollBox)) {
				var kids = document.getAnonymousNodes(scrollBox);
				scrollBox.mScrollBoxObject = kids[1].boxObject.QueryInterface(Components.interfaces.nsIScrollBoxObject);
			}
			scrollBox.mScrollBoxObject.ensureElementIsVisible(popup.childNodes[popup.currentIndex]);
		}
		catch(e) {
		}
	},
  
	// manage panels 
	
	addPanel : function(aURI, aTitle, aNoConfirm) 
	{
		if (!aURI || aURI == 'about:blank') {
			return;
		}

		var check = { value : null };
		var retVal;

		var panels = this.panels;
		var panel;
		panels.some(function(aPanel) {
			if (aPanel.sidebar != aURI) return false;
			panel = aPanel;
			return true;
		});
		if (panel) {
			check.value = this.getPref('ezsidebar.noconfirm.exist');
			if (!check.value) {
				var id = 'ezsidebar:broadcaster:'+aURI;
				if (this.currentPanel != id)
					toggleSidebar(id);
			}
			else {
				this.PromptService.alertCheck(
					window,
					this.strbundle.GetStringFromName('messages_title'),
					this.strbundle.GetStringFromName('add_panel_exist').replace(/%s/gi, aURI),
					this.strbundle.GetStringFromName('message_never_show_dialog'),
					check
				);
				if (check.value)
					this.setPref('ezsidebar.noconfirm.exist', true);
			}
			return;
		}

		if (!aURI ||
			!aURI.match(/^((https?|ftp|file|chrome|resource):\/\/|urn:|about:)/))
			return;

		check.value = aNoConfirm || this.getPref('ezsidebar.noconfirm.add');
		if (!check.value) {
			retVal = this.PromptService.confirmCheck(
					window,
					this.strbundle.GetStringFromName('messages_title'),
					this.strbundle.GetStringFromName('add_panel_confirm').replace(/%s/gi, aTitle || '').replace(/%uri/gi, aURI),
					this.strbundle.GetStringFromName('add_panel_never_show_dialog'),
					check
				);
			if (retVal && check.value)
				this.setPref('ezsidebar.noconfirm.add', true);
			if (!retVal)
				return;
		}

		if (!aTitle) {
			var title = { value : '' };
			if (!this.PromptService.prompt(
					window,
					this.strbundle.GetStringFromName('messages_title'),
					this.strbundle.GetStringFromName('add_panel_title'),
					title,
					null,
					{}
				))
				return;

			aTitle = title.value;
			if (!aTitle) return;
		}

		panels.push({
			uri     : aURI,
			name    : aTitle,
			sidebar : aURI
		});
		this.panels = panels;

		this.setFavIconFor(aURI);

		window.setTimeout(toggleSidebar, 200, 'ezsidebar:broadcaster:'+aURI);
	},
	
	addNewPanel : function() 
	{
		var doc = window.gBrowser.contentDocument;
		var data = {
				uri   : (this.hostWindow ? window.gBrowser.currentURI.spec : null ),
				title : (this.hostWindow ? Components.lookupMethod(doc, 'title').call(doc) : null ),
				add   : false
			};
		if (data.uri == 'about:blank') data.uri = null;
		window.openDialog(
			'chrome://ezsidebar/content/addPanel.xul',
			'_blank',
			'chrome,modal,dialog,resizable=no',
			data
		);

		if (!data.add || !data.uri) return;


		this.addPanel(data.uri, data.title);
	},
 
	setFavIconFor : function(aURI, aPanel) 
	{
		if (!/^(https?|file|chrome|resource|data):/.test(aURI)) return;
		var request  = new XMLHttpRequest();
		var listener = new EzSidebarFavIconLoader(aURI, request, aPanel);
		request.onload = function() { listener.handleEvent(); };
		request.open('GET', aURI);
		request.send(null);
	},
  
	renamePanel : function(aID, aOut) 
	{
		if (aOut) aOut.value = false;
		if (!this.isUserDefined(aID)) return;

		var uri = aID.replace(/^ezsidebar:\w+:/, '');

		var panels = this.panels;
		var panel;
		panels.some(function(aPanel) {
			if (aPanel.uri != uri) return false;
			panel = aPanel;
			return true;
		}, this);

		var title = panel.name;

		var newTitleObj = { value : title };
		if (!this.PromptService.prompt(
				window,
				this.strbundle.GetStringFromName('messages_title'),
				this.strbundle.GetStringFromName('change_panel_title').replace(/%s/gi, title),
				newTitleObj,
				null,
				{}
			))
			return;

		newTitle = newTitleObj.value;
		if (!newTitle || newTitle == title) return;

		panel.name = newTitle;
		this.panels = panels;

		this.sidebarTitle.setAttribute('value', newTitle);

		this.updateTitlebar();

		if (aOut) aOut.value = true;
	},
	
	renameCurrentPanel : function() 
	{
		this.renamePanel(this.currentPanel);
	},
  
	removePanel : function(aID, aOut) 
	{
		if (aOut) aOut.value = false;
		if (!this.isUserDefined(aID)) return;

		var uri = aID.replace(/^ezsidebar:\w+:/, '');

		var panels = this.panels;
		var panel;
		panels.some(function(aPanel) {
			if (aPanel.uri != uri) return false;
			panel = aPanel;
			return true;
		}, this);
		if (!panel) return;

		var title = panel.name;

		var check = { value : this.getPref('ezsidebar.noconfirm.remove') };
		if (!check.value) {
			retVal = this.PromptService.confirmCheck(
					window,
					this.strbundle.GetStringFromName('messages_title'),
					this.strbundle.GetStringFromName('remove_panel_confirm').replace(/%s/gi, title),
					this.strbundle.GetStringFromName('remove_panel_never_show_dialog'),
					check
				);
			if (retVal && check.value)
				this.setPref('ezsidebar.noconfirm.remove', true);
			if (!retVal)
				return;
		}

		this.panels = panels.filter(function(aPanel) {
			return aPanel.uri != uri;
		});

		if (this.sidebarBox.getAttribute('sidebarcommand') == aID) {
			this.sidebarBox.setAttribute('hidden', true);
			this.sidebarSplitter.collapsed = true;
		}

		if (aOut) aOut.value = true;
	},
	
	removeCurrentPanel : function() 
	{
		var id  = this.currentPanel;
		if (!this.isUserDefined(id)) return;

		var obj = { value : false };
		this.removePanel(id, obj);
		if (!obj.value) return;

		var popup = document.getElementById('viewSidebarMenu');
		var item  = popup.getElementsByAttribute('observes', id);
		item = item[0].parentNode == popup ? item[0] : item[1] ;

		toggleSidebar(
			(item.nextSibling.localName == 'menuitem' &&
			item.nextSibling.getAttribute('ezsidebar-generated')) ?
				item.nextSibling.getAttribute('observes') :
			(item.previousSibling.localName == 'menuitem' &&
			item.previousSibling.getAttribute('ezsidebar-generated')) ?
				item.previousSibling.getAttribute('observes') :
			'viewBookmarksSidebar'
		);
	},
  
	setKeyboardShortcutFor : function(aID, aShouldClear) 
	{
		if (!this.isUserDefined(aID)) return;

		var uri = aID.replace(/^ezsidebar:\w+:/, '');

		var panels = this.panels;
		var panel;
		panels.some(function(aPanel) {
			if (aPanel.uri != uri) return false;
			panel = aPanel;
			return true;
		}, this);
		if (!panel) return;

		if (aShouldClear) {
			delete panel.key;
			delete panel.keyCode;
			delete panel.modifiers;
		}
		else {
			var key  = document.getElementById(aID.replace(/^ezsidebar:broadcaster:/, 'ezsidebar:key:'));
			var mod  = key ? key.getAttribute('modifiers') : '' ;
			var data = key ? {
					key      : key.getAttribute('key').toUpperCase(),
					charCode : key.getAttribute('key').toUpperCase().charCodeAt(0),
					keyCode  : key.getAttribute('keycode'),
					altKey   : (mod.match(/alt/) ? true : false),
					ctrlKey  : (mod.match(/control/) ? true : false),
					metaKey  : (mod.match(/meta/) ? true : false),
					shiftKey : (mod.match(/shift/) ? true : false),
					string   : '',
					modified : false
				} :
				{
					key      : '',
					charCode : 0,
					keyCode  : '',
					altKey   : false,
					ctrlKey  : false,
					metaKey  : false,
					shiftKey : false,
					string   : '',
					modified : false
				};

			window.openDialog(
				'chrome://ezsidebar/content/keyDetecter.xul',
				'_blank',
				'chrome,modal,centerscreen,dialog=no',
				data,
				this.strbundle.GetStringFromName('keyboardShortcut_description'),
				this.strbundle.GetStringFromName('keyboardShortcut_cancel')
			);
			if (!data.modified) return;

			var modifiers = [];
			if (data.altKey)   modifiers.push('alt');
			if (data.ctrlKey)  modifiers.push('control');
			if (data.metaKey)  modifiers.push('meta');
			if (data.shiftKey) modifiers.push('shift');

			if (data.key) panel.key = data.key;
			if (data.keyCode) panel.keyCode = data.keyCode;
			if (modifiers.length) panel.modifiers = modifiers.join(',');

			if (panel.key || data.keyCode || modifiers.length)
				this.PromptService.alert(
					window,
					this.strbundle.GetStringFromName('messages_title'),
					this.strbundle.GetStringFromName('keyboardShortcut_complete')
						.replace(/%t/gi, panel.name)
						.replace(/%s/gi, data.string)
				);
		}
		this.panels = panels;
	},
	
	setKeyboardShortcutForCurrentPanel : function(aShouldClear) 
	{
		this.setKeyboardShortcutFor(this.currentPanel, aShouldClear);
	},
  
	toggleSidebar : function(aCommand, aForceToOpen, aWebPanelTitle, aWebPanelURI) 
	{
		var ESS = EzSidebarService;
		if (!ESS.initialized) {
			window.setTimeout(toggleSidebar, 10, aCommand, aForceToOpen, aWebPanelTitle, aWebPanelURI);
			return;
		}

		var isNullCommand = !aCommand;
		if (!aCommand)
			aCommand = ESS.currentPanel;

		ESS.setPref('ezsidebar.lastCommand', aCommand);

		// for All-In-One Sidebar
		// http://firefox.exxile.net/
		var aioToggleBox = document.getElementById('aios-toggle-toolbox');
		if (aioToggleBox)
			aioToggleBox.setAttribute('sidebar-lastopen', aCommand);

		if (ESS.isUndocked &&
			document.getElementById(aCommand))
			ESS.ObserverService.notifyObservers(
				window,
				'toggleSidebar',
				aCommand+'\n'+(document.getElementById(aCommand).getAttribute('checked') != 'true')
			);

		if (ESS.isUndocked) {
			var sidebarWindow;
			if (ESS.isSidebarWindow) {
				var command = document.getElementById(aCommand);
				if (isNullCommand ||
					(
						aCommand == ESS.currentPanel &&
						command &&
						command.getAttribute('checked')
					)) {
					ESS.ObserverService.notifyObservers(window, 'sidebarWindowHidden', null);
					window.close();
				}
				else if (command && !command.getAttribute('checked'))
					ESS.toggleSidebarInternal(aCommand);
			}
			else if (sidebarWindow = ESS.sidebarWindow) {
				if (isNullCommand ||
					aCommand == sidebarWindow.EzSidebarService.currentPanel) {
					ESS.ObserverService.notifyObservers(window, 'sidebarWindowHidden', null);
					sidebarWindow.close();
				}
				else {
					sidebarWindow.EzSidebarService.toggleSidebarInternal(aCommand);
					sidebarWindow.focus();
				}
			}
			else {
				ESS.sidebarBox.setAttribute('sidebarcommand', aCommand);
				ESS.showSidebarWindow(aCommand, aWebPanelTitle, aWebPanelURI);
			}
		}
		else {
			ESS.toggleSidebarInternal(aCommand);
			ESS.setPref('ezsidebar.show', ESS.sidebarBox.getAttribute('hidden') != 'true');
		}
	},

	toggleSidebarInternal : function(aCommandID)
	{
		if ('gInPrintPreviewMode' in window && window.gInPrintPreviewMode)
			return;

		if (!aCommandID)
			aCommandID = this.sidebarBox.getAttribute('sidebarcommand');

		var commandNode = document.getElementById(aCommandID);

		if (this.isSidebarWindow) {
			this.hostWindows.forEach(function(aWindow) {
				var sv = aWindow.EzSidebarService;
				sv.sidebarBox.setAttribute('sidebarcommand', aCommandID);
				sv.sidebarBox.setAttribute('src', commandNode.getAttribute('sidebarurl'));
				sv.sidebarTitle.setAttribute('value', commandNode.getAttribute('label'));
			}, this);
		}

		var url   = commandNode.getAttribute('sidebarurl');
		var title = commandNode.getAttribute('sidebartitle');
		if (!title) title = commandNode.getAttribute('label');

		var collapsed = this.sidebarCollapsed;
		if (this.isUserDefined(aCommandID)) { // switch to userSidebar
			if (this.sidebar != this.userSidebar) {
				this.userSidebar.setAttribute('src', 'about:blank');
				this.userSidebar.loadURI('about:blank');
				this.sidebarCollapsed = true;
			}
			this.sidebar = this.userSidebar;
		}
		else { // switch to staticSidebar
			if (this.sidebar != this.staticSidebar) {
				this.staticSidebar.setAttribute('src', 'about:blank');
				this.staticSidebar.loadURI('about:blank');
				this.sidebarCollapsed = true;
			}
			this.sidebar = this.staticSidebar;
		}
		this.sidebarCollapsed = collapsed;

		if (commandNode.getAttribute('checked') == 'true') {
			commandNode.removeAttribute('checked');
			this.sidebarBox.setAttribute('sidebarcommand', '');
			this.sidebarTitle.setAttribute('value', '');
			this.updateTitlebar();
			this.sidebarBox.setAttribute('hidden', true);
			this.sidebarSplitter.collapsed = true;

			this.ObserverService.notifyObservers(window, 'sidebarWindowHidden', null);

			if ('aios_synchSidebar' in window) aios_synchSidebar();

			return;
		}

		var commandNodes = document.getElementsByAttribute('group', 'sidebar');
		for (var i = 0; i < commandNodes.length; ++i)
			commandNodes[i].removeAttribute('checked');

		commandNode.setAttribute('checked', true);

		if (this.sidebarBox.getAttribute('hidden') == 'true') {
			this.sidebarBox.removeAttribute('hidden');
			this.sidebarSplitter.collapsed = false;
			this.initSidebarPanel();
		}

		if (!('sidebarProgressListener' in this.sidebar) ||
			!this.sidebar.sidebarProgressListener)
			this.initProgressListener(this.sidebar);

		this.sidebar.setAttribute('src', url);
		this.sidebarBox.setAttribute('src', url);
		this.sidebar.loadURI(url); // browser fails to load "about:..." URIs by attribute.

		this.sidebarBox.setAttribute('sidebarcommand', commandNode.id);
		this.sidebarTitle.setAttribute('value', title);

		if ('aios_synchSidebar' in window) aios_synchSidebar();

		this.updateTitlebar();
	},
	initSidebarPanel : function()
	{
		// initialize history
		if (!this.userSidebar.historyInitialized) {
			try {
				this.userSidebar.webNavigation.sessionHistory = Components.classes['@mozilla.org/browser/shistory;1'].createInstance(Components.interfaces.nsISHistory);
				var gh = this.userSidebar.docShell.QueryInterface(Components.interfaces.nsIDocShellHistory);
				if ('useGlobalHistory' in gh) // Firefox 1.1 or later?
					gh.useGlobalHistory = true;
				else // Firefox 1.0 or before
					gh.globalHistory = Components.classes['@mozilla.org/browser/global-history;1'].getService(Components.interfaces.nsIGlobalHistory);
			}
			catch(e) {
//				alert(e);
			}
			try {
				if (this.userSidebar.securityUI &&
					this.userSidebar.contentDocument)
					this.userSidebar.securityUI.init(this.userSidebar.contentWindow);
			}
			catch(e) {
//				alert(e);
			}
			this.userSidebar.historyInitialized = true;
		}

		if (!this.browserStatusHandler) {
			this.browserStatusHandler = this.crateBrowserStatusHandler();
			this.userSidebar.addProgressListener(this.browserStatusHandler, Components.interfaces.nsIWebProgress.NOTIFY_ALL);
		}
	},
	crateBrowserStatusHandler : function()
	{
		return {
			stopCommand            : document.getElementById('Browser:Stop'),
			reloadCommand          : document.getElementById('Browser:Reload'),
			reloadSkipCacheCommand : document.getElementById('Browser:ReloadSkipCache'),
			isImage                : document.getElementById('isImage'),
			browser                : this.userSidebar,

			QueryInterface : function(aIID)
			{
				if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
					aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
					aIID.equals(Components.interfaces.nsISupports))
					return this;
				throw Components.results.NS_NOINTERFACE;
			},

			onProgressChange : function (aWebProgress, aRequest,
										aCurSelfProgress, aMaxSelfProgress,
										aCurTotalProgress, aMaxTotalProgress)
			{
			},

			onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus)
			{
				const nsIWebProgressListener = Components.interfaces.nsIWebProgressListener;
				const nsIChannel = Components.interfaces.nsIChannel;
				if (aStateFlags & nsIWebProgressListener.STATE_START) {
					this.stopCommand.removeAttribute('disabled');
				}
				else if (aStateFlags & nsIWebProgressListener.STATE_STOP) {
					if (aRequest) {
						if (this.browser.contentDocument &&
							this.mimeTypeIsTextBased(this.browser.contentDocument.contentType))
							this.isImage.removeAttribute('disabled');
						else
							this.isImage.setAttribute('disabled', true);
					}
					this.stopCommand.setAttribute('disabled', true);
				}
			},

			onLocationChange : function(aWebProgress, aRequest, aLocation)
			{
				if (this.browser.contentDocument &&
					this.mimeTypeIsTextBased(this.browser.contentDocument.contentType))
					this.isImage.removeAttribute('disabled');
				else
					this.isImage.setAttribute('disabled', true);

				if (aWebProgress.DOMWindow == content) {
					var location = aLocation.spec;
					if (location == 'about:blank' || location == '') {
						this.reloadCommand.setAttribute('disabled', true);
						this.reloadSkipCacheCommand.setAttribute('disabled', true);
					} else {
						this.reloadCommand.removeAttribute('disabled');
						this.reloadSkipCacheCommand.removeAttribute('disabled');
					}
				}
			},

			mimeTypeIsTextBased : function(contentType)
			{
				return /^text\/|\+xml$/.test(contentType) ||
					contentType == "application/javascript" ||
					contentType == "application/xml" ||
					contentType == "mozilla.application/cached-xul";
			},

			onStatusChange : function(aWebProgress, aRequest, aStatus, aMessage)
			{
			},

			onSecurityChange : function(aWebProgress, aRequest, aState)
			{
			}
		};
	},
	browserStatusHandler : null,
  
	// dock/undock 
	
	dock : function(aNode) 
	{
		if (!this.isUndocked) return;

		this.setPref('ezsidebar.independent', false);

		if (aNode) this.hidePopup(aNode);

		var w = this.hostWindow;
		if (w) {
			if (this.getPref('ezsidebar.show')) {
				w.document.getElementById(this.currentPanel).removeAttribute('checked');
				// if we do this operation directory, "this.docShell has no property" error appears.
				var panel = this.currentPanel;
				w.setTimeout(function() { w.EzSidebarService.toggleSidebarInternal(panel); }, 0);
			}
		}
		else
			window.openDialog(this.browserURI, '_blank', 'chrome,all,dialog=no');

		var sidebarWindow = this.sidebarWindow;
		if (sidebarWindow) {
			sidebarWindow.EzSidebarService.docked = true;
			sidebarWindow.close();
		}
	},
 
	undock : function(aNode) 
	{
		if (this.isUndocked || this.isSidebarWindow) return;

		if (aNode) this.hidePopup(aNode);

		this.setPref('ezsidebar.independent', true);

		this.sidebarBox.setAttribute('hidden', true);
		this.sidebarSplitter.collapsed = true;
		this.showSidebarWindow();
	},
  
	// collapse/expand 
	
	collapseExpand : function(aNotToSave) 
	{
		if (!this.isSidebarWindow ||
			window.windowState == window.STATE_MINIMIZED)
			return;

		if (this.sidebar.boxObject.height)
			this.sidebarHeight = this.sidebar.boxObject.height; // 常に、開いた状態の高さを保持しておく

		this.sidebarCollapsed = !this.sidebarCollapsed;
		window.resizeBy(
			0,
			!this.sidebarCollapsed ? this.sidebarHeight : -this.sidebarHeight
		);

		if (!aNotToSave)
			window.setTimeout('EzSidebarService.saveSize();', 0);
	},
	saveSize : function()
	{
		this.setPref('ezsidebar.collapsed', this.sidebarCollapsed);
		this.setPref('ezsidebar.contentHeight', this.sidebarHeight);
		this.setPref('ezsidebar.width', window.outerWidth);
		this.setPref('ezsidebar.height', window.outerHeight);
	},
 
	setAutoCollapse : function() 
	{
		this.autoCollapse = !this.getPref('ezsidebar.autoCollapse');
		this.setPref('ezsidebar.autoCollapse', this.autoCollapse);

		if (!this.autoCollapse && this.sidebarCollapsed)
			this.collapseExpand();
	},
	
	collapseExpandAutomatically : function(aEvent) 
	{
		if (!EzSidebarService.autoCollapse) return;

		var x = 'screenX' in aEvent ? aEvent.screenX : 0 ;
		var y = 'screenY' in aEvent ? aEvent.screenY : 0 ;
		if (EzSidebarService.sidebarCollapsed) {
			if (aEvent.type == 'blur') return;
			if (
				aEvent.type == 'focus' ||
				(
					x >= window.screenX &&
					x <= window.screenX + window.outerWidth &&
					y >= window.screenY &&
					y <= window.screenY + window.outerHeight
				)
				)
				EzSidebarService.collapseExpand();
		}
		else {
			if (aEvent.type == 'focus') return;
			if (
				aEvent.type == 'blur' ||
				(
					x < window.screenX ||
					x > window.screenX + window.outerWidth ||
					y < window.screenY ||
					y > window.screenY + window.outerHeight
				)
				)
				EzSidebarService.collapseExpand();
		}
	},
 
	collapseExpandAutomaticallyCheck : function(aEvent) 
	{
		var w = EzSidebarService.sidebarWindow;
		if (
			!w ||
			!('EzSidebarService' in w) ||
			!w.EzSidebarService.autoCollapse ||
			w.EzSidebarService.sidebarCollapsed
			)
			return;

		w.EzSidebarService.collapseExpand();
	},
   
	// auto close depending on Browser 
	setAutoClose : function()
	{
		this.setPref('ezsidebar.autoClose', !this.getPref('ezsidebar.autoClose'));
	},
 
	setAutoMinimize : function() 
	{
		this.setPref('ezsidebar.sync_minimize_state.enabled', !this.getPref('ezsidebar.sync_minimize_state.enabled'));
	},
 
	setHideOnStartup : function() 
	{
		this.setPref('ezsidebar.hideOnStartup', !this.getPref('ezsidebar.hideOnStartup'));
	},
 
	// rise on top 
	setAlwaysRaised : function()
	{
		// On Mac OS, "always raised" windows are shown as modal dialogs.
		// We have to ignore this operation because "always raised" undocked-sidebar prevents to use main browser-window.
		if (navigator.platform.match(/mac/i)) {
			this.clearPref('ezsidebar.alwaysRaised');
			return;
		}

		this.setPref('ezsidebar.alwaysRaised', !this.getPref('ezsidebar.alwaysRaised'));
		this.reopenSidebarWindow();
	},
	reopenSidebarWindow : function()
	{
		var nav = this.hostWindow;
		if (this.sidebarWindow && nav)
			nav.setTimeout(
				function(aWindow)
				{
					aWindow.EzSidebarService.sidebarWindow.close();
					aWindow.EzSidebarService.showSidebarWindow();
				},
				10,
				nav
			);
	},
 
	// drag and drop 
	
	onDragDropEvent : function(aMethod, aEvent) 
	{
		var top = Components.lookupMethod(window, 'top').call(window);
		if (
			this.getDocShellFromDocument(
					aEvent.originalTarget.ownerDocument,
					top
						.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
						.getInterface(Components.interfaces.nsIWebNavigation)
						.QueryInterface(Components.interfaces.nsIDocShell)
				)
				.QueryInterface(Components.interfaces.nsIWebNavigation)
				.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
				.getInterface(Components.interfaces.nsIDOMWindow)
				!= top ||
			(
				!aEvent.target.getAttribute('ezsidebar-item') &&
				aEvent.target.localName.match(/^(menu|menuitem|menuseparator|menupopup|popup|tooltip)$/)
			)
			)
			return;

		nsDragAndDrop[aMethod](aEvent, this);
	},
 
	canHandleMultipleItems : false, 
 
	getSidebarHeader : function(aEvent) 
	{
		var header = aEvent.target;
		while (header.parentNode && header.localName != 'sidebarheader')
			header = header.parentNode;

		return (!header || header.localName != 'sidebarheader') ? null : header ;
	},
 
	onDragStart : function(aEvent, aTransferData, aDragAction) 
	{
		var isMenuItem = (aEvent.target.localName == 'menuitem');
		if (!isMenuItem &&
			(!this.getSidebarHeader(aEvent) || !this.isCurrentUserDefined))
			return;

		var uri, title, broadcaster;
		if (isMenuItem) {
			broadcaster = document.getElementById(aEvent.target.getAttribute('observes'));
			uri   = broadcaster.getAttribute('sidebarurl');
			title = broadcaster.getAttribute('sidebartitle');
		}
		else {
			uri   = this.sidebarBox.getAttribute('src');
			title = this.sidebarTitle.getAttribute('value');
		}

		if (aEvent.ctrlKey || aEvent.metaKey) {
			window.setTimeout(
				function(aManager, aID)
				{
					if (!aID || aID == aManager.currentPanel)
						aManager.removeCurrentPanel();
					else
						aManager.removePanel(aID, {});
				},
				0,
				this,
				(isMenuItem ? broadcaster.id : null )
			);
			return;
		}

		aTransferData.data = new TransferData();

		if (isMenuItem) {
			this.dragItem = aEvent.target;
			aTransferData.data.addDataForFlavour('xul/sidebarpanel', uri+'\n'+title);
		}

		aTransferData.data.addDataForFlavour('text/x-moz-url', uri+'\n'+title);
		aTransferData.data.addDataForFlavour('text/html', '<a href="'+uri+'">'+title+'</a>');
		aTransferData.data.addDataForFlavour('text/unicode', uri);
	},
 
	onDrop : function(aEvent, aTransferData, aSession) 
	{
		var uri   = null,
			title = null;
		switch(aTransferData.flavour.contentType)
		{
			case 'xul/sidebarpanel':
				uri   = aTransferData.data.split('\n')[0];
				title = aTransferData.data.split('\n')[1];
				var node = aEvent.target;
				if (node.getAttribute('ezsidebar-item')) {
					this.onMovePanel(uri, aEvent);
					return;
				}
				break;

			case 'text/x-moz-url':
				uri   = aTransferData.data.split('\n')[0];
				title = aTransferData.data.split('\n')[1];
				break;

			case 'text/unicode':
				if (aTransferData.data.match(/^\w+:\/\//)) return;
				uri = aTransferData.data;
				break;

			case 'application/x-moz-file':
				uri = this.getURLSpecFromFile(aTransferData.data);
				break;

			default:
				break;
		}

		this.addPanel(uri, title);
	},
	
	onMovePanel : function(aURI, aEvent) 
	{
		aEvent.target.removeAttribute('dragover-top');
		aEvent.target.removeAttribute('dragover-bottom');

		var targetURI = document.getElementById(aEvent.target.getAttribute('observes')).getAttribute('sidebarurl');
		var panels = this.panels;
		var toIndex = 0;
		var fromIndex = 0;
		panels.forEach(function(aPanel, aIndex) {
			if (aPanel.sidebar == targetURI)
				toIndex = aIndex;
			if (aPanel.sidebar == aURI)
				fromIndex = aIndex;
		});
		if (toIndex == fromIndex) return;

		var panel = panels.splice(fromIndex, 1)[0];
		if (fromIndex < toIndex) toIndex--;
		if (panels.length < toIndex)
			panels.splice(toIndex, 0, panel);
		else
			panels.push(panel);

		this.panels = panels;

		aEvent.target.parentNode.hidePopup();
	},
  
	onDragOver : function(aEvent, aFlavour, aSession) 
	{
		if (this.dragItem == aEvent.target ||
			!aEvent.target.getAttribute('ezsidebar-generated')) return;

		var node = this.dragItem;
		while (node && node != aEvent.target && node.getAttribute('ezsidebar-generated'))
			node = node.nextSibling;

		if (node && node == aEvent.target)
			aEvent.target.setAttribute('dragover-bottom', true);
		else
			aEvent.target.setAttribute('dragover-top', true);
	},
 
	onDragExit : function(aEvent, aFlavour, aSession) 
	{
		if (!aEvent.target.getAttribute('ezsidebar-generated')) return;

		aEvent.target.removeAttribute('dragover-top');
		aEvent.target.removeAttribute('dragover-bottom');
	},
 
	getSupportedFlavours : function () 
	{
		var flavours = new FlavourSet();
		flavours.appendFlavour('xul/sidebarpanel');
		flavours.appendFlavour('text/x-moz-url');
		flavours.appendFlavour('text/unicode');
		flavours.appendFlavour('application/x-moz-file', 'nsIFile');
		return flavours;
	},
  
	// web panels 
	openWebPanel : function(aTitle, aURI)
	{
		var ESS = EzSidebarService;
		var w = (ESS.isUndocked) ? ESS.sidebarWindow : ESS.hostWindow ;
		if (!w ||
			!ESS.getPref('ezsidebar.show') ||
			ESS.currentPanel != 'viewWebPanelsSidebar') {
			toggleSidebar('viewWebPanelsSidebar', null, aTitle, aURI);
			if (ESS.isUndocked && !w) return;
		}

		ESS = w.EzSidebarService;
		ESS.sidebarTitle.value = aTitle;
		ESS.updateTitlebar();
		if (ESS.sidebar.contentDocument &&
			ESS.sidebar.contentDocument.getElementById('web-panels-browser')) {
			ESS.sidebar.contentWindow.loadWebPanel(aURI);
			if (w.gWebPanelURI) {
				w.gWebPanelURI = '';
				ESS.sidebar.removeEventListener('load', w.asyncOpenWebPanel, true);
			}
        }
		else {
			if (!w.gWebPanelURI)
				w.EzSidebarService.sidebar.addEventListener('load', w.asyncOpenWebPanel, true);
			w.gWebPanelURI = aURI;
		}
	},
 
	// 初期化と終了処理 
	
	init : function() 
	{
		if (this.isSidebarWindow &&
			(this.sidebarWindows.length > 1 || this.sidebarWindow != window)) {
			window.close();
			return;
		}
		if (this.activated) return;
		this.activated = true;

		if (!this.sidebarBox) return; // not browser, not sidebar

		this.migratePanels();

		this.sidebarHeight = this.getPref('ezsidebar.contentHeight') || 0;

		var alwaysRaised = document.getElementById('ezsidebar:broadcaster:alwaysRaised');
		if (navigator.platform.match(/mac/i)) {
			this.clearPref('ezsidebar.alwaysRaised');
			alwaysRaised.setAttribute('hidden', true);
		}
		else
			alwaysRaised.removeAttribute('hidden');


		// override functions
		if (window.sidebar &&
			this.getPref('ezsidebar.override.addPanelOperation')) {
			window.sidebar.addPanel = this.sidebarAddPanel;
		}
		if (this.sidebarBox) {
			this.staticSidebar.collapsed = false;
			this.staticSidebar.hidden    = false;
			this.userSidebar.collapsed   = false;
			this.userSidebar.hidden      = false;

			/*
				Now, I use "hidden" attribute to apply the style rule
				"visibility:collapse", instead of "display:none".
				So, we don't have to use "collapsed" property and attribute
				for the sidebar-box.
			*/
//			// "hidden" property breaks sidebar browser's "docShell" property. We have to use "collapsed" instead of it.
//			this.sidebarBox.hidden = false;
			this.sidebarSplitter.hidden = false;

			this.sidebar = this.staticSidebar;

			nsContextMenu.prototype.__ezsidebar__initItems = nsContextMenu.prototype.initItems;
			nsContextMenu.prototype.initItems = this.initItems;
			window.__ezsidebar__toggleSidebar = window.toggleSidebar;
			window.toggleSidebar = this.toggleSidebar;
			window.__ezsidebar__openWebPanel = window.openWebPanel;
			window.openWebPanel = this.openWebPanel;

			// for old Firebird
			if ('contentAreaClick' in window &&
				window.contentAreaClick.arity < 2) {
				window.__ezsidebar__contentAreaClick = window.contentAreaClick;
				window.contentAreaClick = this.contentAreaClick;
			}

			var header = this.sidebarHeader;

			// create a button into sidebarheader
			var button = document.createElement('toolbarbutton');
			var popup  = document.getElementById('sidebar-panel-popup').cloneNode(true);
			button.setAttribute('type',  'menu');
			button.setAttribute('label', popup.getAttribute('label'));
			popup.id = '';
			button.appendChild(popup);
			header.insertBefore(button, header.lastChild);
			button.id = 'ezsidebar-panels-button';

			var stack = document.getElementById('template:sidebar-title-stack');
			if (stack) {
				header.replaceChild(stack.parentNode.removeChild(stack), this.sidebarTitle);
				stack.id = stack.id.replace(/^template:/, '');
				stack.firstChild.id = stack.firstChild.id.replace(/^template:/, '');
				stack.lastChild.id = stack.lastChild.id.replace(/^template:/, '');
				if (stack.nextSibling.localName == 'spacer')
					header.removeChild(stack.nextSibling);
			}

			button = document.getElementById(this.isSidebarWindow ? 'template:sidebar-dock-button' : 'template:sidebar-undock-button' );
			header.insertBefore(button.parentNode.removeChild(button), header.lastChild);
			button.id = button.id.replace(/^template:/, '');
		}
		// print preview
		if ('toggleAffectedChrome' in window) {
			window.toggleAffectedChrome = function(aHide)
			{
				var navToolbox = document.getElementById("navigator-toolbox");
				navToolbox.hidden = aHide;
				var statusbar = document.getElementById("status-bar");
				statusbar.hidden = aHide;
				if (aHide)
				{
					gChromeState = {};
					var sidebar = document.getElementById("sidebar-box");
					const sv = EzSidebarService;
					gChromeState.sidebarOpen = sv.isUndocked ?
						sv.sidebarWindow :
						sv.sidebarBox.getAttribute('hidden') != 'true' ;
				}

				if (gChromeState.sidebarOpen)
					toggleSidebar();
			}
		}

		if (this.isSidebarWindow) {
			button.nextSibling.hidden = true;

			this.autoCollapse = this.getPref('ezsidebar.autoCollapse') || false;

			window.addEventListener('mouseover', this.collapseExpandAutomatically, true);
			window.addEventListener('mouseout', this.collapseExpandAutomatically, true);
			window.addEventListener('focus', this.collapseExpandAutomatically, true);
			window.addEventListener('blur', this.collapseExpandAutomatically, false);

			if (this.getPref('ezsidebar.collapsed'))
				window.setTimeout('EzSidebarService.collapseExpand();', 0);

			this.updateSidebarWindowBroadcasters();

			if (this.hostWindow)
				this.hostWindow.EzSidebarWindowStateWatcher.start();
		}
		else {
			window.addEventListener('click', this.collapseExpandAutomaticallyCheck, true);
			window.addEventListener('keydown', this.collapseExpandAutomaticallyCheck, true);
			window.addEventListener('focus', this.collapseExpandAutomaticallyCheck, true);

			// hide sidebar
			if (
				this.sidebarBox &&
				(
					this.isUndocked ||
					!this.getPref('ezsidebar.show') ||
					this.getPref('ezsidebar.hideOnStartup')
				)
				) {
				this.sidebarBox.setAttribute('hidden', true);
				this.sidebarSplitter.collapsed = true;
			}

			EzSidebarWindowStateWatcher.init();
		}


		window.addEventListener('keydown',   this.onKeyDown,    true);
		window.addEventListener('keyup',     this.onKeyRelease, true);
		window.addEventListener('keypress',  this.onKeyRelease, true);
		window.addEventListener('mousedown', this.onKeyRelease, true);


		// for borwser window
		if (this.sidebarBox)
			window.setTimeout('EzSidebarService.initWithDelay();', 0);
	},
	initialShow : function()
	{
		// show custom buttons only in the initial startup
		var bar = document.getElementById('nav-bar');
		if (bar && bar.currentSet) {
			var currentset = bar.currentSet;
			var buttons = currentset.replace(/__empty/, '').split(',');
			var initial = [
					'ezsidebar-toggle-button'
				];
			for (var i in initial)
			{
				if (!this.getPref(this.PREFROOT+'.initialshow.'+initial[i])) {
					if (currentset.indexOf(initial[i]) < 0)
						buttons.push(initial[i]);
					this.setPref(this.PREFROOT+'.initialshow.'+initial[i], true);
				}
			}
			currentset = bar.currentSet.replace(/__empty/, '');
			var newset = buttons.join(',');
			if (currentset != newset &&
				this.PromptService.confirmEx(
					null,
					this.strbundle.GetStringFromName('initialshow_confirm_title'),
					this.strbundle.GetStringFromName('initialshow_confirm_text'),
					(this.PromptService.BUTTON_TITLE_YES * this.PromptService.BUTTON_POS_0) +
					(this.PromptService.BUTTON_TITLE_NO  * this.PromptService.BUTTON_POS_1),
					null, null, null, null, {}
				) == 0) {
				bar.currentSet = newset;
				bar.setAttribute('currentset', newset);
				document.persist(bar.id, 'currentset');
			}
			if ('BrowserToolboxCustomizeDone' in window)
				window.setTimeout('BrowserToolboxCustomizeDone(true);', 0);
		}
	},
	
	initWithDelay : function() 
	{
		this.rebuild();

		this.initSidebarPanel();

		var lastCommand = this.lastPanel;
		if (this.isSidebarWindow) {
			this.initStaticPanels();
			if (this.sidebarBox.getAttribute('sidebarcommand') != lastCommand ||
				this.sidebarBox.hidden)
				toggleSidebar(lastCommand);
			if ('arguments' in window &&
				window.arguments.length &&
				window.arguments.length > 2 &&
				window.arguments[0] == 'viewWebPanelsSidebar' &&
				(window.arguments[1] || window.arguments[2])) {
				this.openWebPanel(window.arguments[1], window.arguments[2]);
			}
		}
		else {
			try {
				this.ObserverService.addObserver(this, 'toggleSidebar', false);
			}
			catch(e) {
			}
			this.ObserverService.addObserver(this, 'sidebarWindowCompletelyShown', false);
			this.ObserverService.addObserver(this, 'sidebarWindowHidden', false);
			document.getElementById('viewSidebarMenu').addEventListener('popupshowing', this.onViewSidebarMenuPoppshowing, true);

			this.getStaticPanels();

			// when only this window is the first browser
			if (this.getPref('ezsidebar.shouldShow') &&
				this.hostWindows.length == 1) {
				this.setPref('ezsidebar.shouldShow', false);
				this.setPref('ezsidebar.show', true);
			}

			if (this.getPref('ezsidebar.hideOnStartup'))
				this.setPref('ezsidebar.show', false);

			window.setTimeout('EzSidebarService.initBrowserWindow();', 100);
		}

		this.addPrefListener(this);


		// for All-In-One Sidebar
		// http://firefox.exxile.net/
		var aiosButton      = document.getElementById('sidebars-button-header');
		var ezsidebarButton = document.getElementById('ezsidebar-panels-button');
		if (aiosButton) {
			var popup = document.getElementById('aios_viewSidebarMenu');
			popup.parentNode.removeChild(popup);
			aiosButton.appendChild(ezsidebarButton.removeChild(ezsidebarButton.firstChild));

			ezsidebarButton.setAttribute('hidden', true);

			eval('window.aios_toggleSidebar = ' +aios_toggleSidebar.toString().replace(
				/fx_sidebarBox\.hidden/g,
				'(EzSidebarService.isUndocked ? !EzSidebarService.sidebarWindow : fx_sidebarBox.hidden)'
			));
			eval('window.aios_synchSidebar = ' +aios_synchSidebar.toString().replace(
				/fx_sidebarBox\.hidden/g,
				'(EzSidebarService.isUndocked ? !EzSidebarService.sidebarWindow : fx_sidebarBox.hidden)'
			));
		}
		else {
			ezsidebarButton.removeAttribute('hidden');
		}

		this.initialized = true;

		this.initialShow();
	},
	initBrowserWindow : function()
	{
		// for Linux platform
		this.rebuild();

		var lastCommand = this.lastPanel;
		if (this.getPref('ezsidebar.show')) {
			if (!this.sidebarWindow && lastCommand) {
				toggleSidebar(lastCommand);
				if (!this.isUndocked &&
					this.sidebarBox.getAttribute('hidden') == 'true')
					toggleSidebar(lastCommand);
			}
		}
	},
 
	migratePanels : function() 
	{
		if (this.getPref('ezsidebar.panels') !== null) return;

		var migrated = [];
		var ds = this.panelsDS;
		var node, data, resource;
		for (var i = 0, maxi = ds.length; i < maxi; i++)
		{
			data = template.ezsidebarTemplate(i, ds);
			resource = ds.item(i);
			if (!data || !('localName' in data)) continue;

			migrated.push({
				uri       : resource.Value,
				name      : ds.getData(resource, 'Name'),
				sidebar   : ds.getData(resource, 'URL'),
				image     : ds.getData(resource, 'Icon'),
				key       : ds.getData(resource, 'Key'),
				keyCode   : ds.getData(resource, 'Keycode'),
				modifiers : ds.getData(resource, 'Modifiers')
			});
		}

		this.panels = migrated;
	},
 
	getStaticPanels : function() 
	{
		var popup  = document.getElementById('viewSidebarMenu'),
			items  = [],
			labels = [];
		for (var i = 0; !popup.childNodes[i].getAttribute('ezsidebar-item'); i++)
			if (popup.childNodes[i].localName == 'menuitem')
				items.push(popup.childNodes[i]);

		var panels = this.staticPanels;
		if (panels.length == items.length) {
			if (panels.every(function(aPanel, aIndex) {
					items[aIndex].setAttribute('ezsidebar-id', items[aIndex].getAttribute('observes'));
					return items[aIndex].label == aPanel.name;
				}, this))
				return;
		}

		panels = [];
		items.forEach(function(aItem) {
			var panel = { name : aItem.getAttribute('label') };

			panel.itemAttr = {};
			Array.slice(aItem.attributes).forEach(function(aAttr) {
					panel.itemAttr[aAttr.name] = aAttr.value;
				});
			panel.itemAttr.observes = aItem.getAttribute('observes');
			panel.itemAttr.key = aItem.getAttribute('key');

			panel.broadcasterAttr = {};
			var broadcaster = document.getElementById(aItem.getAttribute('observes'));
			if (broadcaster)
				Array.slice(broadcaster.attributes).forEach(function(aAttr) {
					panel.broadcasterAttr[aAttr.name] = aAttr.value;
				});

			panel.keyAttr = {};
			var key = document.getElementById(aItem.getAttribute('key'));
			if (key)
				Array.slice(key.attributes).forEach(function(aAttr) {
					panel.keyAttr[aAttr.name] = aAttr.value;
				});

			panels.push(panel);
		}, this);
		this.staticPanels = panels;
	},

	initStaticPanels : function()
	{
		var broadcasterset = document.getElementById('mainBroadcasterSet');
		var keyset         = document.getElementById('mainKeyset');
		var popup          = document.getElementById('viewSidebarMenu');
		var firstItem = popup.firstChild;

		var panels = this.staticPanels;
		panels.forEach(function(aPanel) {
			var key = document.createElement('key');
			for (let i in aPanel.keyAttr)
			{
				key.setAttribute(i, aPanel.keyAttr[i]);
			}
			if ('id' in aPanel.keyAttr &&
				!document.getElementById(key.getAttribute('id')))
				keyset.appendChild(key);

			var broadcaster = document.createElement('broadcaster');
			for (let i in aPanel.broadcasterAttr)
			{
				broadcaster.setAttribute(i, aPanel.keyAttr[i]);
			}
			if ('id' in aPanel.broadcasterAttr &&
				!document.getElementById(broadcaster.getAttribute('id')))
				broadcasterset.appendChild(broadcaster);

			var item = document.createElement('menuitem');
			for (let i in aPanel.itemAttr)
			{
				item.setAttribute(i, aPanel.itemAttr[i]);
			}
			item.setAttribute('ezsidebar-id', item.getAttribute('observes'));
			if ('observes' in aPanel.itemAttr &&
				!popup.getElementsByAttribute('observes', item.getAttribute('observes')).length)
				popup.insertBefore(item, firstItem);
		}, this);
	},
 
	sidebarAddPanel : function(aTitle, aContentURL, aCustomizeURL) { 
		EzSidebarService.addPanel(aContentURL, aTitle);
	},
 
	onViewSidebarMenuPoppshowing : function(aEvent) 
	{
		if (aEvent.target.id != 'viewSidebarMenu') return;

		aEvent.target.setAttribute('sidebar', EzSidebarService.getPref('ezsidebar.show') ? 'shown' : 'hidden' );
		aEvent.target.setAttribute('sidebarstate', EzSidebarService.isUndocked ? 'undocked' : 'docked' );
	},
 
	onStateChange : function(aWebProgress, aRequest, aStateFlags, aStatus) 
	{
		this.__ezsidebar__onStateChange(aWebProgress, aRequest, aStateFlags, aStatus);

		var w = aWebProgress.DOMWindow;
		const PL = Components.interfaces.nsIWebProgressListener;
		if ((aStateFlags & PL.STATE_IS_DOCUMENT ||
			aStateFlags & PL.STATE_IS_WINDOW) &&
			'sidebar' in w && w.sidebar && !('ezsidebar' in w.sidebar)) {
			w.sidebar = {
				addPanel  : EzSidebarService.sidebarAddPanel,
				ezsidebar : true
			};
		}
	},
 
	updateSidebarWindowBroadcasters : function() 
	{
		var collapseExpand = document.getElementById('ezsidebar:broadcaster:collapseExpand');
		var autoCollapse = document.getElementById('ezsidebar:broadcaster:autoCollapse');
		if (this.autoCollapse) {
			collapseExpand.setAttribute('disabled', true);
			autoCollapse.setAttribute('checked', true);
		}
		else {
			collapseExpand.removeAttribute('disabled');
			autoCollapse.removeAttribute('checked');
		}

		var alwaysRaised = document.getElementById('ezsidebar:broadcaster:alwaysRaised');
		if (this.getPref('ezsidebar.alwaysRaised'))
			alwaysRaised.setAttribute('checked', true);
		else
			alwaysRaised.removeAttribute('checked');

		var autoClose = document.getElementById('ezsidebar:broadcaster:autoClose');
		if (this.getPref('ezsidebar.autoClose'))
			autoClose.setAttribute('checked', true);
		else
			autoClose.removeAttribute('checked');

		var autoMinimize = document.getElementById('ezsidebar:broadcaster:autoMinimize');
		if (this.getPref('ezsidebar.sync_minimize_state.enabled'))
			autoMinimize.setAttribute('checked', true);
		else
			autoMinimize.removeAttribute('checked');

		var hideOnStartup = document.getElementById('ezsidebar:broadcaster:hideOnStartup');
		if (this.getPref('ezsidebar.hideOnStartup'))
			hideOnStartup.setAttribute('checked', true);
		else
			hideOnStartup.removeAttribute('checked');
	},
 
	contentAreaClick : function(aEvent, aFieldNormalClicks) 
	{
		var node = aEvent.target,
			linkNode;

		switch (node.localName.toLowerCase())
		{
			case 'a':
			case 'area':
			case 'link':
				if (node.hasAttribute('href'))
					linkNode = node;
				break;
			default:
				linkNode = aEvent.originalTarget || node;
				while (linkNode && !(linkNode instanceof HTMLAnchorElement))
					linkNode = linkNode.parentNode;
				if (linkNode && !linkNode.hasAttribute('href'))
					linkNode = null;
				break;
		}

		if (linkNode &&
			aFieldNormalClicks &&
			aEvent.button == 0 &&
			!aEvent.ctrlKey &&
			!aEvent.shiftKey &&
			!aEvent.altKey &&
			!aEvent.metaKey &&
			(!linkNode.getAttribute('target') || linkNode.getAttribute('target') == '_content')) {
			var uri = getShortcutOrURI(linkNode.href);
			if (!uri) return false;
			markLinkVisited(linkNode.href, linkNode);
			loadURI(uri);
			aEvent.preventDefault();
			return false;
		}

		return __ezsidebar__contentAreaClick(aEvent, aFieldNormalClicks);
	},
  
	destruct : function() 
	{
		if (!this.activated) return;
		this.activated = false;
		this.windowIsClosing = true;

		if (this.userSidebar && this.browserStatusHandler) {
			try {
				this.userSidebar.removeProgressListener(this.browserStatusHandler);
			}
			catch(e) {
			}
			this.browserStatusHandler.stopCommand = null;
			this.browserStatusHandler.reloadCommand = null;
			this.browserStatusHandler.reloadSkipCacheCommand = null;
			this.browserStatusHandler.isImage = null;
			this.browserStatusHandler.browser = null;
			this.browserStatusHandler = null;
		}

		var host = this.hostWindows;
		if (
			this.getPref('ezsidebar.autoClose') &&
			!this.isSidebarWindow &&
			this.sidebarWindow &&
			(
				!host.length ||
				(host.length == 1 && host[0] == window)
			)
			) {
			if (!EzSidebarService.docked &&
				!EzSidebarService.getPref('ezsidebar.hideOnStartup'))
				EzSidebarService.setPref('ezsidebar.shouldShow', true);
			this.sidebarWindow.close();
		}

		if (this.sidebarBox) {
			if ('sidebarProgressListener' in this.staticSidebar) {
				this.staticSidebar.sidebarProgressFilter.removeProgressListener(this.staticSidebar.sidebarProgressListener);
				this.staticSidebar.removeProgressListener(this.staticSidebar.sidebarProgressFilter);
			}
			if ('sidebarProgressListener' in this.userSidebar) {
				this.userSidebar.sidebarProgressFilter.removeProgressListener(this.userSidebar.sidebarProgressListener);
				this.userSidebar.removeProgressListener(this.userSidebar.sidebarProgressFilter);
			}
			this.removePrefListener(this);
		}

		if (this.isSidebarWindow) {
			window.removeEventListener('mouseover', this.collapseExpandAutomatically, true);
			window.removeEventListener('mouseout', this.collapseExpandAutomatically, true);
			window.removeEventListener('focus', this.collapseExpandAutomatically, true);
			window.removeEventListener('blur', this.collapseExpandAutomatically, false);

			if (this.sidebarCollapsed)
				this.collapseExpand(true);
		}
		else {
			window.removeEventListener('click', this.collapseExpandAutomaticallyCheck, true);
			window.removeEventListener('keydown', this.collapseExpandAutomaticallyCheck, true);
			window.removeEventListener('focus', this.collapseExpandAutomaticallyCheck, true);

			if (this.sidebarBox) {
				try {
					this.ObserverService.removeObserver(this, 'toggleSidebar', false);
				}
				catch(e) {
				}
				this.ObserverService.removeObserver(this, 'sidebarWindowCompletelyShown', false);
				this.ObserverService.removeObserver(this, 'sidebarWindowHidden', false);
				document.getElementById('viewSidebarMenu').removeEventListener('popupshowing', this.onViewSidebarMenuPoppshowing, true);
			}

			EzSidebarWindowStateWatcher.destroy();
		}


		window.removeEventListener('keydown',   this.onKeyDown,    true);
		window.removeEventListener('keyup',     this.onKeyRelease, true);
		window.removeEventListener('keypress',  this.onKeyRelease, true);
		window.removeEventListener('mousedown', this.onKeyRelease, true);
	},
  
// obsolete 
	
	get datasource() 
	{
		if (!this._datasource) {
			var uri;
			try {
				uri = this.IOService.newFileURI(this.datasourceFile).spec;
			}
			catch(e) { // [[interchangeability for Mozilla 1.1]]
				uri = this.IOService.getURLSpecFromFile(this.datasourceFile);
			}
			// create datasource object
			this._datasource = this.RDF.GetDataSource(uri);
		}
		return this._datasource;
	},
	_datasource : null,
 
	get datasourceFile() 
	{
		if (!this._datasourceFile) {
			// get ProfileDirectory
			const DIR = Components.classes['@mozilla.org/file/directory_service;1'].getService(Components.interfaces.nsIProperties);
			var dir = DIR.get('ProfD', Components.interfaces.nsILocalFile);

			// get URI
			var tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
			tempLocalFile.initWithPath(this.getPref('ezsidebar.datasource.file') || dir.path);

			var uri = this.getURLSpecFromFile(tempLocalFile);

			if (!uri.match(/\/$/)) uri += '/';
			if (tempLocalFile.isDirectory()) uri += 'ezsidebar.rdf';


			// if the file doesn't exist, create it.
			try {
				var fileHandler = this.IOService.getProtocolHandler('file').QueryInterface(Components.interfaces.nsIFileProtocolHandler);
				tempLocalFile = fileHandler.getFileFromURLSpec(uri);
			}
			catch(e) { // [[interchangeability for Mozilla 1.1]]
				try {
					tempLocalFile = this.IOService.getFileFromURLSpec(uri);
				}
				catch(ex) { // [[interchangeability for Mozilla 1.0.x]]
					tempLocalFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);
					this.IOService.initFileFromURLSpec(tempLocalFile, uri);
				}
			}

			if (!tempLocalFile.exists())
				tempLocalFile.create(tempLocalFile.NORMAL_FILE_TYPE, 0644);

			this._datasourceFile = tempLocalFile;
		}
		return this._datasourceFile;
	},
	_datasourceFile : null,
 
	get panelsDS() 
	{
		if (!this._panels)
			this._panels = new pRDFData('panels', this.datasource.URI, 'seq', 'http://white.sakura.ne.jp/~piro/rdf#', 'chrome://ezsidebar/content/ezsidebar.rdf#');
		return this._panels;
	},
	_panels : null,
 
	get staticPanelsDS() 
	{
		if (!this._staticPanels)
			this._staticPanels = new pRDFData('staticPanels', this.datasource.URI, 'seq', 'http://white.sakura.ne.jp/~piro/rdf#', 'chrome://ezsidebar/content/ezsidebar.rdf#');
		return this._staticPanels;
	},
	_staticPanels : null,
 
	get RDF() 
	{
		if (!this._RDF) {
			this._RDF = Components.classes['@mozilla.org/rdf/rdf-service;1'].getService(Components.interfaces.nsIRDFService);
		}
		return this._RDF;
	},
	_RDF : null,
 
	chooseFile : function(aTitle, aFilter, aCustomFilters) 
	{
		const nsIFilePicker = Components.interfaces.nsIFilePicker;
		const FP = Components.classes['@mozilla.org/filepicker;1'].createInstance(nsIFilePicker);

		FP.init(window, aTitle, nsIFilePicker.modeOpen);

		var filter = nsIFilePicker.filterAll;
		if (aFilter) {
			filter = aFilter | filter;
		}
		if (aCustomFilters) {
			for (var i in aCustomFilters)
				FP.appendFilter(aCustomFilters[i].label, aCustomFilters[i].pattern);
		}

		FP.appendFilters(filter);
		if (aFilter)
			FP.filterIndex = 1;

		FP.show();

		var file;
		try {
			file = FP.file.QueryInterface(Components.interfaces.nsILocalFile);
		}
		catch(e) {
			return null;
		}

		return file;
	},
  
	___ : null 
};
EzSidebarService.__proto__ = window['piro.sakura.ne.jp'].prefs;
  
var EzSidebarWindowStateWatcher = 
{
	domain  : 'ezsidebar.sync_minimize_state.enabled',
	timer   : null,
	service : EzSidebarService,

	defaultInterval : 200,
	
	get enabled() 
	{
		return this.service.getPref(this.domain);
	},
 
	observe : function(aSubject, aTopic, aPrefName) 
	{
		if (aTopic != 'nsPref:changed') return;

		var sidebar = this.service.sidebarWindow;
		var active  = this.enabled;
		if (!active || !sidebar) {
			this.stop();
		}
		else if (active && sidebar) {
			this.start();
		}
	},
 
	checkWindowState : function() 
	{
		var sidebar = EzSidebarService.sidebarWindow;
		var host    = EzSidebarService.hostWindow;

		if (host && !sidebar) host.EzSidebarWindowStateWatcher.stop();
		if (!host || !sidebar) return;

		if (
			host.windowState == host.STATE_MINIMIZED ||
			(host.screenX == -32000 && host.screenY == -32000) // for Windows
			) {
			if (host.EzSidebarService.lastState == host.STATE_NORMAL) {
				host.EzSidebarService.lastState = host.STATE_MINIMIZED;
				sidebar.hostState = host.STATE_MINIMIZED;
				if (sidebar.windowState != sidebar.STATE_MINIMIZED)
					sidebar.minimize();
			}
		}
		else {
			if (host.EzSidebarService.lastState == host.STATE_MINIMIZED) {
				host.EzSidebarService.lastState = host.STATE_NORMAL;
				if (sidebar.windowState == sidebar.STATE_MINIMIZED)
					sidebar.restore();
			}
		}
	},
 
	start : function() 
	{
//		dump('EZSIDEBAR::timer_start\n');
		if (!this.timer)
			this.timer = window.setInterval(
				this.checkWindowState,
				Math.max(this.service.getPref('ezsidebar.sync_minimize_state.interval'), 0) || this.defaultInterval
			);
	},
 
	stop : function() 
	{
//		dump('EZSIDEBAR::timer_stop\n');
		if (this.timer) {
			window.clearInterval(this.timer);
			this.timer = null;
		}
	},
 
	init : function() 
	{
		EzSidebarService.addPrefListener(this);
	},
 
	destroy : function() 
	{
		this.stop();
		EzSidebarService.removePrefListener(this);
	},
 
}; 
  
function EzSidebarFavIconLoader(aPanelURI, aRequest) 
{
	this.mURI     = aPanelURI;
	this.mRequest = aRequest;
}

EzSidebarFavIconLoader.prototype = {
	mURI     : null,
	mRequest : null,
	
	handleEvent : function() 
	{
		if (
			!this.mRequest.responseText ||
			!this.mRequest.channel.contentType ||
			!this.mRequest.channel.contentType.match(/text\/(html|xml)|application\/(xml|[^\+]+\+xml)/i)
			)
			return;

		var favIconURI;

		var links = this.mRequest.responseText.match(/<([^:>]+:)?link\s([^>]*\s)?rel\s*=\s*("\s*(shortcut\s+)?icon\s*"|'\s*(shortcut\s+)?icon\s*'|\s*(shortcut\s+)?icon\s?)[^>]*>/ig);

		if (!links || !links.length) {
			var end = (this.mRequest.channel.URI.port == -1) ? '/favicon.ico' : (':' + this.mRequest.channel.URI.port + '/favicon.ico');
			favIconURI = this.mRequest.channel.URI.scheme + '://' + this.mRequest.channel.URI.host + end;

			this.mRequest.abort();
			this.loadFavIcon(favIconURI);
			return;
		}

		for (var i = 0; i < links.length; i++)
		{
			favIconURI = this.getFavIconURIFromLink(links[i]);
			if (favIconURI)
				this.loadFavIcon(favIconURI);
		}

		this.mRequest.abort();
	},
 
	getFavIconURIFromLink : function(aLink) 
	{
		if (!aLink.match(/href\s*=\s*("[^"]+"|'[^']+')/i)) return null;

		var baseURI  = this.mRequest.channel.URI;
		var fragment = RegExp.$1.match(/^["'](.*)["']$/)[1];

		var base = this.mRequest.responseText.match(/<([^:>]+:)?base\s([^>]*\s)?href\s*=\s*("[^"]+"|'[^']+')[^>]*>/i);
		if (base && RegExp.$3) {
			base = RegExp.$3.match(/^["'](.*)["']$/)[1];
			if (base.match(/^\w+:\/\//))
				baseURI = EzSidebarService.IOService.newURI(base, null, null);
			else
				baseURI = EzSidebarService.IOService.newURI(baseURI.resolve(base), null, null);
		}

		uri = EzSidebarService.IOService.newURI(baseURI.resolve(fragment), null, null).spec;

		try {
			if (!this.checkSecurity(uri)) return null;
		}
		catch(e) {
			return null;
		}

		return uri;
	},
 
	checkSecurity : function(aURI) 
	{
		const nsIContentPolicy = Components.interfaces.nsIContentPolicy;
		try {
			var contentPolicy = Components.classes['@mozilla.org/layout/content-policy;1'].getService(nsIContentPolicy);
		}
		catch(e) {
			return false; // Refuse to load if we can't do a security check.
		}


		// Verify that the load of this icon is legal.

		var uri     = EzSidebarService.IOService.newURI(aURI, null, null);
		var origURI = EzSidebarService.IOService.newURI(this.mRequest.channel.URI.spec, null, null);

		const secMan = Components.classes['@mozilla.org/scriptsecuritymanager;1'].getService(Components.interfaces.nsIScriptSecurityManager);
		const nsIScriptSecMan = Components.interfaces.nsIScriptSecurityManager;
		try {
			secMan.checkLoadURI(origURI, uri, nsIScriptSecMan.STANDARD);
		}
		catch(e) {
			return false;
		}

/*
		if (contentPolicy.shouldLoad(
				nsIContentPolicy.TYPE_IMAGE,
				uri,
				origURI,
				aEvent.target,
				safeGetProperty(aEvent.target, 'type'),
				null
			) != nsIContentPolicy.ACCEPT)
			return false;
*/

		return true;
	},
 
	loadFavIcon : function(aFavIconURI) 
	{
		var loader = new pImageLoader(aFavIconURI, this);
		loader.load();
	},
 
	onImageLoad : function(aImageData) 
	{
		if (!aImageData) return;

		var panels = EzSidebarService.panels;
		panels.some(function(aPanel) {
			if (aPanel.uri != this.mURI) return false;
			aPanel.image = aImageData;
			return true;
		}, this);
		EzSidebarService.panels = panels;
	}
 
}; 
  
// 初期化 
// initialize
window.addEventListener('load', function()
{
	if (EzSidebarService.activated) return;

	EzSidebarService.init();
},
false);

window.addEventListener('unload', function()
{
	if (!EzSidebarService.activated) return;

	EzSidebarService.destruct();
},
false);
	
function EzSidebarOverrideStartupFunc() {
	if (EzSidebarService.sidebarBox) { 
		var funcName = ('BrowserStartup' in window && !('__ezsidebar__BrowserStartup' in window)) ? 'BrowserStartup' :
				('Startup' in window && !('__ezsidebar__Startup' in window)) ? 'Startup' :
				null ;

		if (funcName) {
			window['__ezsidebar__'+funcName] = window[funcName];
			window[funcName] = function() {
				// if the command item isn't generated yet, startup operation fails.
				var cmd = EzSidebarService.sidebarBox.getAttribute('sidebarcommand');
				if (cmd && (cmd.match(/^ezsidebar:/) || !document.getElementById(cmd)))
					EzSidebarService.sidebarBox.setAttribute('sidebarcommand', '');

				window['__ezsidebar__'+funcName]();

				if (cmd && cmd.match(/^ezsidebar:/) && document.getElementById(cmd))
					EzSidebarService.sidebarBox.setAttribute('sidebarcommand', cmd);
			};
		}
	}
}
EzSidebarOverrideStartupFunc();
  
