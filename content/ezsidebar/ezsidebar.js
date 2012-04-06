// static class "EzSidebarService" 
var EzSidebarService =
{
	PREFROOT : 'extensions.{0EAF175C-0C46-4932-AB7D-F45D6C46F367}.',
	
	// properties 
	
	get browserWindow() 
	{
		return this.getTopWindowOf('navigator:browser');
	},
 
	get browserWindows() 
	{
		return this.getWindowsOf('navigator:browser');
	},
 
	get sidebarBox() 
	{
		return this._sidebarBox ||
				(this._sidebarBox = document.getElementById('sidebar-box'));
	},
 
	get splitter() 
	{
		return this._splitter ||
				(this._splitter = document.getElementById('sidebar-splitter'));
	},
 
	get header() 
	{
		return this._header ||
				(this._header = document.getElementById('sidebar-header'));
	},
 
	get sidebar() 
	{
		return this._sidebar ||
				(this._sidebar = document.getElementById('sidebar'));
	},
 
	get panel() 
	{
		if (this._panel)
			return this._panel;

		var panel = document.createElement('panel');
		panel.setAttribute('id', 'ezsidebar-panel');
		panel.setAttribute('noautohide', true); // required to keep the panel shown
		document.documentElement.appendChild(panel);
		return this._panel = panel;
	},
 
	get x() 
	{
		return this.getPref(this.PREFROOT + 'x');
	},
	set x(aValue)
	{
		this.setPref(this.PREFROOT + 'x', aValue);
		return aValue;
	},
 
	get y() 
	{
		return this.getPref(this.PREFROOT + 'y');
	},
	set y(aValue)
	{
		this.setPref(this.PREFROOT + 'y', aValue);
		return aValue;
	},
 
	get width() 
	{
		return this.getPref(this.PREFROOT + 'width');
	},
	set width(aValue)
	{
		this.setPref(this.PREFROOT + 'width', aValue);
		return aValue;
	},
 
	get height() 
	{
		return this.getPref(this.PREFROOT + 'height');
	},
	set height(aValue)
	{
		this.setPref(this.PREFROOT + 'height', aValue);
		return aValue;
	},
 
	get hidden() 
	{
		return this.sidebarBox.hidden || this.sidebarBox.collapsed;
	},
 
	get collapsed() 
	{
		return this.getPref(this.PREFROOT + 'collapsed');
	},
	set collapsed(aValue)
	{
		this.setPref(this.PREFROOT + 'collapsed', this.resizerBar.collapsed = this.sidebar.collasped = !!aValue);
		return aValue;
	},
  
	// observers and listeners 
	
	observe : function(aSubject, aTopic, aData) 
	{
		switch(aTopic)
		{
			case 'nsPref:changed':
				break;

			default:
				break;
		}
	},
	// for pref listener
	domain : 'ezsidebar.',
 
	handleEvent : function(aEvent) 
	{
		switch(aEvent.type)
		{
			case 'DOMContentLoaded':
				return this.init();
			case 'unload':
				return this.destroy();

			case 'dblclick':
				return this.toggleCollapsed();

			case 'mousedown':
				return this.onMouseDown(aEvent);
			case 'mousemove':
				return this.onMouseMove(aEvent);
			case 'mouseup':
				return this.onMouseUp(aEvent);

			case 'popupshown':
				return this.updateSize();

			case 'DOMAttrModified':
				if (aEvent.originalTarget == this.sidebarBox &&
					(aEvent.attrName == 'hidden' || aEvent.attrName == 'collapsed'))
					this.showHidePanel(this.hidden);
				return;

			case 'focus':
				return this.onFocused();

			default:
				break;
		}
	},
	
	onMouseDown : function(aEvent) 
	{
		if (aEvent.currentTarget == this.header)
			this.startMove(aEvent);
		else
			this.startResize(aEvent);
	},
	
	startMove : function(aEvent) 
	{
		var outer = this.panel.getOuterScreenRect();
		this.baseX = outer.left;
		this.baseY = outer.top;
		this.startX = aEvent.screenX;
		this.startY = aEvent.screenY;
		this.moving = true;
		aEvent.target.setCapture();
	},
 
	startResize : function(aEvent) 
	{
		var outer = this.panel.getOuterScreenRect();
		this.baseWidth = outer.width;
		this.baseHeight = outer.height;
		this.startX = aEvent.screenX;
		this.startY = aEvent.screenY;
		this.resizing = true;
		aEvent.preventDefault();
		aEvent.stopPropagation();
		aEvent.target.setCapture();
	},
  
	onMouseMove : function(aEvent) 
	{
		if (this.repositioning)
			return;
		var dX = aEvent.screenX - this.startX;
		var dY = aEvent.screenY - this.startY;
		if (this.moving) {
			this.repositioning = true;
			this.panel.moveTo(this.x = this.baseX + dX,
								this.y = this.baseY + dY);
 			window.setTimeout(function(aSelf) { aSelf.repositioning = false; }, 0, this);
		}
		else if (this.resizing) {
			this.repositioning = true;
			this.panel.sizeTo(this.width = this.baseWidth + dX,
								this.height = this.baseHeight + dY);
 			window.setTimeout(function(aSelf) { aSelf.repositioning = false; }, 0, this);
		}
	},
 
	onMouseUp : function(aEvent) 
	{
		if (!this.moving && !this.resizing)
			return;

		this.moving = false;
		this.resizing = false;
		aEvent.target.releaseCapture();
	},
 
	onFocused : function()
	{
		if (this.hidden)
			return;

		var current = this.browserWindow;
		this.browserWindows.forEach(function(aWindow) {
			aWindow.EzSidebarService.showHidePanel(aWindow == current);
		}, this);
	},
   
	// XPConnect 
	
	get ObserverService() 
	{
		return this._ObserverService ||
				(this._ObserverService = Components.classes['@mozilla.org/observer-service;1']
											.getService(Components.interfaces.nsIObserverService));
	},
 
	get WindowManager() 
	{
		return this._WindowManager ||
				(this._WindowManager = Components.classes['@mozilla.org/appshell/window-mediator;1']
										.getService(Components.interfaces.nsIWindowMediator));
	},
  
	getTopWindowOf : function(aWindowType) 
	{
		return this.WindowManager.getMostRecentWindow(aWindowType) || null ;
	},
	
	getWindowsOf : function(aWindowType) 
	{
		var targetWindows = [];
		var targets = this.WindowManager.getEnumerator(aWindowType, true);
		while (targets.hasMoreElements())
		{
			let target = targets.getNext().QueryInterface(Components.interfaces.nsIDOMWindow);
			targetWindows.push(target);
		}
		return targetWindows;
	},
  
	toggleCollapsed : function() 
	{
		this.collapsed = !this.collapsed;
		this.updateSize();
	},
 
	updateSize : function() 
	{
		if (this.collapsed)
			this.panel.sizeTo(this.width, this.header.boxObject.height);
		else
			this.panel.sizeTo(this.width, this.height);
	},
 
	showHidePanel : function(aShow) 
	{
		var panel = this.panel;
		if (aShow)
			panel.hidePopup();
		else
			panel.openPopupAtScreen(this.x, this.y, false);

		// we have to do it after the splitter was shown completely.
		window.setTimeout(function(aSelf) { aSelf.splitter.hidden = true; }, 0, this);
	},
 
	init : function() 
	{
		window.removeEventListener('DOMContentLoaded', this, false);

		var sidebarBox = this.sidebarBox;
		this.panel.appendChild(sidebarBox); // this automatically removes the box from the document tree and inserts under the panel
		sidebarBox.setAttribute('flex', 1); // required to expand panel contents

		this.resizerBar = document.createElement('hbox');
		this.resizerBar.appendChild(document.createElement('spacer')).setAttribute('flex', 1);
		this.resizer = this.resizerBar.appendChild(document.createElement('resizer'));
		this.panel.appendChild(this.resizerBar);

		this.header.addEventListener('mousedown', this, false);
		this.header.addEventListener('dblclick', this, false);
		this.resizer.addEventListener('mousedown', this, true);
		this.panel.addEventListener('mousemove', this, false);
		this.panel.addEventListener('mouseup', this, false);
		this.panel.addEventListener('popupshown', this, false);
		this.sidebarBox.addEventListener('DOMAttrModified', this, false);
//		window.addEventListener('focus', this, false);

		window.addEventListener('load', this, false);
		window.addEventListener('unload', this, false);
	},
	onLoad : function()
	{
		window.removeEventListener('load', this, false);
		if (!this.hidden)
			this.showHidePanel(true);
	},
 
	destroy : function() 
	{
		window.removeEventListener('unload', this, false);

		this.header.removeEventListener('mousedown', this, false);
		this.header.removeEventListener('dblclick', this, false);
		this.resizer.removeEventListener('mousedown', this, true);
		this.panel.removeEventListener('mousemove', this, false);
		this.panel.removeEventListener('mouseup', this, false);
		this.panel.removeEventListener('popupshown', this, false);
		this.sidebarBox.removeEventListener('DOMAttrModified', this, false);
//		window.removeEventListener('focus', this, false);

		delete this._sidebarBox;
		delete this._sidebar;
		delete this._header;
		delete this._splitter;
		delete this._panel;
		delete this.resizer;
		delete this.resizerBar;
	}

 
}; 
(function() {
	var namespace = {};
	Components.utils.import('resource://ezsidebar-modules/prefs.js', namespace);
	Components.utils.import('resource://ezsidebar-modules/namespace.jsm', namespace);

	EzSidebarService.__proto__ = namespace.prefs;
	EzSidebarService.namespace = namespace.getNamespaceFor('piro.sakura.ne.jp')['piro.sakura.ne.jp'];
})();
  
window.addEventListener('DOMContentLoaded', EzSidebarService, false); 
 
