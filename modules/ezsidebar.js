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

const XULAppInfo = Cc['@mozilla.org/xre/app-info;1']
					.getService(Ci.nsIXULAppInfo)
					.QueryInterface(Ci.nsIXULRuntime);
 
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
 
	get resizerBar() 
	{
		return this._resizerBar ||
				(this._resizerBar = this.document.getElementById('ezsidebar-resizer-bar'));
	},
 
	get panel() 
	{
		if (this._panel)
			return this._panel;

		var panel = this.document.getElementById('ezsidebar-panel');

		var style = <![CDATA[
				#ezsidebar-resizer-left,
				#ezsidebar-resizer-right,
				#ezsidebar-resizer-top,
				#ezsidebar-resizer-bottom,
				#ezsidebar-resizer-top-left,
				#ezsidebar-resizer-top-right,
				#ezsidebar-resizer-bottom-left,
				#ezsidebar-resizer-bottom-right {
					/* border: 1px solid red; */
					position: relative;
					z-index: 1000;
				}
				#ezsidebar-resizer-left,
				#ezsidebar-resizer-right,
				#ezsidebar-resizer-top-left,
				#ezsidebar-resizer-top-right,
				#ezsidebar-resizer-bottom-left,
				#ezsidebar-resizer-bottom-right {
					width: %SIZE%px;
				}
				#ezsidebar-resizer-top,
				#ezsidebar-resizer-bottom,
				#ezsidebar-resizer-top-left,
				#ezsidebar-resizer-top-right,
				#ezsidebar-resizer-bottom-left,
				#ezsidebar-resizer-bottom-right {
					height: %SIZE%px;
				}
				#ezsidebar-resizer-outer-container {
					margin:-%SIZE%px;
				}
			]]>.toString().replace(/%SIZE%/g, this.resizeArea);
		var styleSheet = this.document.createProcessingInstruction('xml-stylesheet',
			'type="text/css" href="data:text/css,'+encodeURIComponent(style)+'"');
		this.document.insertBefore(styleSheet, this.document.documentElement);

		return this._panel = panel;
	},
 
	get autoCollapseButton()
	{
		if (this._autoCollapseButton)
			return this._autoCollapseButton;

		var button = this.document.createElement('toolbarbutton');
		button.setAttribute('id', 'ezsidebar-autocollapse-button');
		button.setAttribute('type', 'checkbox');
		button.setAttribute('autoCheck', 'false');
		button.setAttribute('tooltiptext', this.bundle.getString('autoCollapse.tooltiptext'));
		this.header.insertBefore(button, this.header.firstChild);

		return this._autoCollapseButton = button;
	},
	updateAutoCollapseButton : function()
	{
		var button = this.autoCollapseButton;
		if (this.autoCollapse)
			button.removeAttribute('checked');
		else
			button.setAttribute('checked', true);
	},
 
	get bundle() 
	{
		return this._bundle ||
				(this._bundle = this.document.getElementById('ezsidebar-stringbundle'));
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
 
	get resizeArea() 
	{
		return prefs.getPref(this.domain + 'resizeArea');
	},
 
	get autoCollapse() 
	{
		return prefs.getPref(this.domain + 'autoCollapse');
	},
	set autoCollapse(aValue)
	{
		prefs.setPref(this.domain + 'autoCollapse', !!aValue);
		return aValue;
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

			case 'mouseover':
				return this.onMouseOver(aEvent);
			case 'mouseout':
				return this.onMouseOut(aEvent);

			case 'DOMAttrModified':
				return this.onDOMAttrModified(aEvent);

			case 'focus':
				return this.onFocused();

			case 'command':
				return this.onCommand(aEvent);

			default:
				break;
		}
	},
	isEventFiredOnClickable : function(aEvent)
	{
		var doc = aEvent.originalTarget.ownerDocument || aEvent.originalTarget;
		var clickable = doc.evaluate(
				'ancestor-or-self::*[contains(" button toolbarbutton scrollbar nativescrollbar popup menupopup panel tooltip splitter textbox ", concat(" ", local-name(), " "))][1]',
				aEvent.originalTarget,
				null,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		return clickable && clickable != this.panel;
	},
	getResizeOrientationFromEvent : function(aEvent)
	{
		var doc = aEvent.originalTarget.ownerDocument || aEvent.originalTarget;
		var resizer = doc.evaluate(
				'ancestor-or-self::*[@class="ezsidebar-resize-area"][1]',
				aEvent.originalTarget,
				null,
				Ci.nsIDOMXPathResult.FIRST_ORDERED_NODE_TYPE,
				null
			).singleNodeValue;
		if (resizer) {
			if (resizer.id.indexOf('left') > -1) orientation |= this.RESIZE_LEFT;
			if (resizer.id.indexOf('right') > -1) orientation |= this.RESIZE_RIGHT;
			if (resizer.id.indexOf('top') > -1) orientation |= this.RESIZE_TOP;
			if (resizer.id.indexOf('bottom') > -1) orientation |= this.RESIZE_BOTTOM;
			if (orientation)
				return orientation;
		}

		var outer = this.panel.getOuterScreenRect();
		var size = this.resizeArea;
		var orientation = 0;
		if (aEvent.screenX < outer.left + size) orientation |= this.RESIZE_LEFT;
		if (aEvent.screenY < outer.top + size) orientation |= this.RESIZE_TOP;
		if (aEvent.screenX > outer.left + outer.width - size) orientation |= this.RESIZE_RIGHT;
		if (aEvent.screenY > outer.top + outer.height - size) orientation |= this.RESIZE_BOTTOM;
		return orientation;
	},
	RESIZE_NONE   : 0,
	RESIZE_TOP    : (1 << 0),
	RESIZE_BOTTOM : (1 << 1),
	RESIZE_LEFT   : (1 << 2),
	RESIZE_RIGHT  : (1 << 3),
	RESIZE_VERTICAL   : (1 << 0) | (1 << 1),
	RESIZE_HORIZONTAL : (1 << 2) | (1 << 3),
	
	onMouseDown : function(aEvent) 
	{
		var orientation = this.getResizeOrientationFromEvent(aEvent);
		if (orientation)
			return this.startResize(aEvent, orientation);

		if (!this.isEventFiredOnClickable(aEvent))
			return this.startMove(aEvent);
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
 
	startResize : function(aEvent, aOrientation) 
	{
		var outer = this.panel.getOuterScreenRect();
		this.baseX = outer.left;
		this.baseY = outer.top;
		this.baseWidth = outer.width;
		this.baseHeight = outer.height;
		this.startX = aEvent.screenX;
		this.startY = aEvent.screenY;
		this.resizing = aOrientation;
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
			let x = this.baseX;
			let y = this.baseY;

			if (this.resizing & this.RESIZE_TOP)
				y += dY;

			if (this.resizing & this.RESIZE_LEFT)
				x += dX;

			if (x != this.baseX || y != this.baseY)
				this.panel.moveTo(this.x = x, this.y = y);

			let width = this.baseWidth;
			let height = this.baseHeight;

			if (this.resizing & this.RESIZE_LEFT)
				width -= dX;
			else if (this.resizing & this.RESIZE_RIGHT)
				width += dX;

			if (this.resizing & this.RESIZE_TOP)
				height -= dY;
			else if (this.resizing & this.RESIZE_BOTTOM)
				height += dY;

			if (width != this.baseWidth || height != this.baseHeight) {
				if (this.requireResizeHeight && height == this.baseHeight) {
					this.flip ^= 1;
					height += this.flip;
				}
				this.panel.sizeTo(this.width = Math.max(width, this.minWidth),
									this.height = Math.max(height, this.minHeight));
			}

 			this.window.setTimeout(function(aSelf) { aSelf.repositioning = false; }, 0, this);
		}
	},
	flip : 1,
	minWidth : 16,
	minHeight : 16,
	requireResizeHeight : XULAppInfo.OS == 'Linux',
 
	onMouseUp : function(aEvent) 
	{
		if (!this.moving && !this.resizing)
			return;

		this.moving = false;
		this.resizing = this.RESIZE_NONE;
		aEvent.target.releaseCapture();
	},
 
	onMouseOver : function(aEvent) 
	{
		this.hover = true;
		if (!this.autoCollapse)
			return;

		this._autoExpandTimer = this.window.setTimeout(function(aSelf) {
			aSelf._autoExpandTimer = null;
			if (aSelf.hover && aSelf.collapsed)
				aSelf.toggleCollapsed();
		}, prefs.getPref(this.domain + 'autoCollapse.delay.expand'), this);
	},
	_autoExpandTimer : null,
 
	onMouseOut : function(aEvent) 
	{
		this.hover = false;
		if (!this.autoCollapse)
			return;

		this.window.setTimeout(function(aSelf) {
			if (!aSelf.hover && aSelf._autoExpandTimer) {
				aSelf.window.clearTimeout(aSelf._autoExpandTimer);
				aSelf._autoExpandTimer = null;
			}
		}, 0, this);

		if (this._autoCollapseTimer)
			this.window.clearTimeout(this._autoCollapseTimer);
		this._autoCollapseTimer = this.window.setTimeout(function(aSelf) {
			aSelf._autoCollapseTimer = null;
			if (!aSelf.hover && !aSelf.collapsed)
				aSelf.toggleCollapsed();
		}, prefs.getPref(this.domain + 'autoCollapse.delay.collapse'), this);
	},
	_autoCollapseTimer : null,
 
	onDOMAttrModified : function(aEvent) 
	{
		if (aEvent.originalTarget != this.sidebarBox)
			return;

		switch (aEvent.attrName)
		{
			case 'hidden':
			case 'collapsed':
				if (this.sidebarHidden)
					this.hidePanel();
				else
					this.showPanel();
				return;

			case 'sidebarcommand':
				if (aEvent.newValue) EzSidebar.lastCommand = aEvent.newValue;
				return;
		}
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
 
	onCommand : function(aEvent) 
	{
		this.autoCollapse = !this.autoCollapse;
		this.updateAutoCollapseButton();
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

		this.collapsed = this.collapsed;
		this.updateAutoCollapseButton();
		this.panel.openPopupAtScreen(this.x, this.y, false);

		this.window.setTimeout(function(aSelf) { // with All-in-One Sidebar, we have to do it with delay.
			EzSidebar.lastCommand = aSelf.lastCommand;
		}, 0, this);
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
		this.document.getElementById('ezsidebar-resizer-container').appendChild(sidebarBox); // this automatically removes the box from the document tree and inserts under the panel
		sidebarBox.setAttribute('flex', 1); // required to expand panel contents

		this.header.addEventListener('dblclick', this, false);
		this.panel.addEventListener('mousedown', this, true);
		this.panel.addEventListener('mousemove', this, true);
		this.panel.addEventListener('mouseup', this, true);
		this.panel.addEventListener('popupshown', this, false);
		this.panel.addEventListener('mouseover', this, true);
		this.panel.addEventListener('mouseout', this, true);
		this.sidebarBox.addEventListener('DOMAttrModified', this, false);
		this.window.addEventListener('focus', this, true);
		this.autoCollapseButton.addEventListener('command', this, false);

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

		this.header.removeEventListener('dblclick', this, false);
		this.panel.removeEventListener('mousedown', this, true);
		this.panel.removeEventListener('mousemove', this, true);
		this.panel.removeEventListener('mouseup', this, true);
		this.panel.removeEventListener('popupshown', this, false);
		this.panel.removeEventListener('mouseover', this, true);
		this.panel.removeEventListener('mouseout', this, true);
		this.sidebarBox.removeEventListener('DOMAttrModified', this, false);
		this.window.removeEventListener('focus', this, true);
		this.autoCollapseButton.removeEventListener('command', this, false);

		delete this._sidebarBox;
		delete this._sidebar;
		delete this._header;
		delete this._panel;
		delete this._resizerBar;
		delete this._autoCollapseButton;
		delete this._bundle;
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
  
