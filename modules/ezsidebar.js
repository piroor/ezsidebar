/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Ez Sidebar.
 *
 * The Initial Developer of the Original Code is Fox Splitter.
 * Portions created by the Initial Developer are Copyright (C) 2003-2012
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):: SHIMODA Hiroshi <piro.outsider.reflex@gmail.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
 
const EXPORTED_SYMBOLS = ['EzSidebar']; 

Components.utils.import('resource://ezsidebar-modules/prefs.js');
Components.utils.import('resource://ezsidebar-modules/namespace.jsm');

const Cc = Components.classes;
const Ci = Components.interfaces;
 
function EzSidebar(aWindow) 
{
	this.window = aWindow;

	aWindow.addEventListener('DOMContentLoaded', this, false);
	aWindow.EzSidebarService = this;
	EzSidebar.instances.push(this);
}
EzSidebar.prototype = {
	domain : 'extensions.{0EAF175C-0C46-4932-AB7D-F45D6C46F367}.',
	
	// properties 
	
	get document() 
	{
		return this.window.document;
	},
 
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
				(this._sidebarBox = this.document.getElementById('sidebar-box'));
	},
 
	get header() 
	{
		return this._header ||
				(this._header = this.document.getElementById('sidebar-header'));
	},
 
	get sidebar() 
	{
		return this._sidebar ||
				(this._sidebar = this.document.getElementById('sidebar'));
	},
 
	get panel() 
	{
		if (this._panel)
			return this._panel;

		var panel = this.document.createElement('panel');
		panel.setAttribute('id', 'ezsidebar-panel');
		panel.setAttribute('noautohide', true); // required to keep the panel shown
		this.document.documentElement.appendChild(panel);
		return this._panel = panel;
	},
 
	get x() 
	{
		return prefs.getPref(this.domain + 'x');
	},
	set x(aValue)
	{
		prefs.setPref(this.domain + 'x', aValue);
		return aValue;
	},
 
	get y() 
	{
		return prefs.getPref(this.domain + 'y');
	},
	set y(aValue)
	{
		prefs.setPref(this.domain + 'y', aValue);
		return aValue;
	},
 
	get width() 
	{
		return prefs.getPref(this.domain + 'width');
	},
	set width(aValue)
	{
		prefs.setPref(this.domain + 'width', aValue);
		return aValue;
	},
 
	get height() 
	{
		return prefs.getPref(this.domain + 'height');
	},
	set height(aValue)
	{
		prefs.setPref(this.domain + 'height', aValue);
		return aValue;
	},
 
	get sidebarHidden() 
	{
		return this.sidebarBox.hidden || this.sidebarBox.collapsed;
	},
 
	get panelHidden() 
	{
		return this.panel.state != 'open';
	},
 
	get collapsed() 
	{
		return prefs.getPref(this.domain + 'collapsed');
	},
	set collapsed(aValue)
	{
		prefs.setPref(this.domain + 'collapsed', this.resizerBar.collapsed = this.sidebar.collasped = !!aValue);
		return aValue;
	},
 
	get lastCommand() 
	{
		return this.sidebarBox.getAttribute('sidebarcommand');
	},
  
	// event handling 
	
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
					(aEvent.attrName == 'hidden' || aEvent.attrName == 'collapsed')) {
					if (this.sidebarHidden)
						this.hidePanel();
					else
						this.showPanel();
				}
				return;

			case 'focus':
				return this.onFocused();

			default:
				break;
		}
	},
	isEventFiredOnClickable : function(aEvent)
	{
		var clickable = this.document.evaluate(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar nativescrollbar popup menupopup panel tooltip splitter textbox ", concat(" ", local-name(), " "))][1]',
				aEvent.originalTarget,
				null,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		return !clickable || clickable != this.panel;
	},
	
	onMouseDown : function(aEvent) 
	{
		if (this.isEventFiredOnClickable(aEvent))
			return;

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
 			this.window.setTimeout(function(aSelf) { aSelf.repositioning = false; }, 0, this);
		}
		else if (this.resizing) {
			this.repositioning = true;
			this.panel.sizeTo(this.width = this.baseWidth + dX,
								this.height = this.baseHeight + dY);
 			this.window.setTimeout(function(aSelf) { aSelf.repositioning = false; }, 0, this);
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
		if (EzSidebar.hidden || EzSidebar.switching)
			return;

		EzSidebar.switching = true;

		var current = this.window;
		this.browserWindows.forEach(function(aWindow) {
			if (aWindow == current)
				aWindow.EzSidebarService.show();
			else
				aWindow.EzSidebarService.hide();
		}, this);

		this.window.setTimeout(function() { EzSidebar.switching = false; }, 0);
	},
   
	// XPConnect 
	
	get ObserverService() 
	{
		return this._ObserverService ||
				(this._ObserverService = Cc['@mozilla.org/observer-service;1']
											.getService(Ci.nsIObserverService));
	},
 
	get WindowManager() 
	{
		return this._WindowManager ||
				(this._WindowManager = Cc['@mozilla.org/appshell/window-mediator;1']
										.getService(Ci.nsIWindowMediator));
	},
  
	getTopWindowOf : function(aWindowType) 
	{
		return this.WindowManager.getMostRecentWindow(aWindowType) || null ;
	},
	
	getWindowsOf : function(aWindowType) 
	{
		var targetWindows = [];
		var targets = this.WindowManager.getEnumerator(aWindowType);
		while (targets.hasMoreElements())
		{
			let target = targets.getNext().QueryInterface(Ci.nsIDOMWindow);
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
 
	showPanel : function() 
	{
		if (!this.panelHidden)
			return;

		this.panel.openPopupAtScreen(this.x, this.y, false);
		EzSidebar.lastCommand = this.lastCommand;
	},
	hidePanel : function()
	{
		if (this.panelHidden)
			return;

		this.panel.hidePopup();
	},
 
	showSidebar : function() 
	{
		if (this.sidebarHidden)
			this.window.toggleSidebar(EzSidebar.lastCommand);
	},
	hideSidebar : function()
	{
		if (!this.sidebarHidden)
			this.window.toggleSidebar(this.lastCommand);
	},
 
	show : function() 
	{
		if (!this.sidebarHidden)
			this.showPanel();
		else
			this.showSidebar();
	},
	hide : function()
	{
		if (this.sidebarHidden)
			this.hidePanel();
		else
			this.hideSidebar();
	},
 
	init : function() 
	{
		this.window.removeEventListener('DOMContentLoaded', this, false);

		var sidebarBox = this.sidebarBox;
		this.panel.appendChild(sidebarBox); // this automatically removes the box from the document tree and inserts under the panel
		sidebarBox.setAttribute('flex', 1); // required to expand panel contents

		this.resizerBar = this.document.createElement('hbox');
		this.resizerBar.appendChild(this.document.createElement('spacer')).setAttribute('flex', 1);
		this.resizer = this.resizerBar.appendChild(this.document.createElement('resizer'));
		this.panel.appendChild(this.resizerBar);

		this.header.addEventListener('mousedown', this, false);
		this.header.addEventListener('dblclick', this, false);
		this.resizer.addEventListener('mousedown', this, true);
		this.panel.addEventListener('mousemove', this, false);
		this.panel.addEventListener('mouseup', this, false);
		this.panel.addEventListener('popupshown', this, false);
		this.sidebarBox.addEventListener('DOMAttrModified', this, false);
		this.window.addEventListener('focus', this, true);

		this.window.addEventListener('load', this, false);
		this.window.addEventListener('unload', this, false);
	},
	onLoad : function()
	{
		this.window.removeEventListener('load', this, false);
		if (!this.sidebarHidden)
			this.showPanel();
	},
 
	destroy : function() 
	{
		delete this.window.EzSidebarService;

		this.window.removeEventListener('unload', this, false);

		this.header.removeEventListener('mousedown', this, false);
		this.header.removeEventListener('dblclick', this, false);
		this.resizer.removeEventListener('mousedown', this, true);
		this.panel.removeEventListener('mousemove', this, false);
		this.panel.removeEventListener('mouseup', this, false);
		this.panel.removeEventListener('popupshown', this, false);
		this.sidebarBox.removeEventListener('DOMAttrModified', this, false);
		this.window.removeEventListener('focus', this, true);

		delete this._sidebarBox;
		delete this._sidebar;
		delete this._header;
		delete this._panel;
		delete this.resizer;
		delete this.resizerBar;
		delete this.window;

		var index = EzSidebar.instances.indexOf(this);
		EzSidebar.instances.splice(index, 1);
	}
 
}; 
 
EzSidebar.instances = []; 
 
EzSidebar.__defineGetter__('hidden', function() { 
	return EzSidebar.instances.every(function(aService) {
		return aService.panelHidden;
	});
});
 
EzSidebar.__defineGetter__('lastCommand', function() { 
	return prefs.getPref(EzSidebar.prototype.domain + 'lastCommand');
});
EzSidebar.__defineSetter__('lastCommand', function(aValue) { 
	prefs.setPref(EzSidebar.prototype.domain + 'lastCommand', aValue);
	return aValue;
});
  
