function OverrideFunctions()
{
	ezsidebarOverrideContentWindowPointer(window);

	window.__proto__.__defineGetter__('gBrowser', ezsidebarGBrowserGetter);
	window.__proto__.__defineSetter__('gBrowser', ezsidebarDummyFunc);
	window.getBrowser = function()
	{
		return window.gBrowser;
	};

	window.loadURI = function(aURI, aReferrer, aCharset)
	{
		if (EzSidebarService.hostWindow)
			EzSidebarService.hostWindow.loadURI(aURI, aReferrer, aCharset);
		else if (!EzSidebarService.windowIsClosing)
			window.openDialog(EzSidebarService.browserURI, '_blank', 'chrome,all,dialog=no', aURI, aCharset, aReferrer);
	};

	window.__ezsidebar__getReferrer = window.getReferrer;
	window.getReferrer = function(aDocument)
	{
		if (aDocument == window.document) {
			var uri = EzSidebarService.sidebar.currentURI;

			if (uri.scheme.match(/^(chrome|resource|file)/))
				return null;
			else
				return uri;
		}
		return window.__ezsidebar__getReferrer(aDocument);
	};

	if (window.openNewTabWith.toString().match(/navigator:browser/))
		window.openNewTabWith = function(aURI)
		{
			if (EzSidebarService.windowIsClosing) return;

			urlSecurityCheck(aURI, document);

			var browser = EzSidebarService.hostWindow;
			if (!browser) {
				window.openDialog(EzSidebarService.browserURI, '_blank', 'chrome,all,dialog=no', aURI, '', null);
				return;
			}

			var tab = browser.gBrowser.addTab(aURI, getReferrer(document));
			if (!EzSidebarService.getPref('browser.tabs.loadInBackground'))
				browser.gBrowser.selectedTab = tab;
		};
	else if (window.openNewTabWith.toString().match(/top.document.getElementById\("content"\)/))
		window.openNewTabWith = function(aURI, aLinkNode, aEvent, aSecurityCheck)
		{
			if (EzSidebarService.windowIsClosing) return;

			if (aSecurityCheck)
				urlSecurityCheck(aURI, document);

			var browser = EzSidebarService.hostWindow;
			if (!browser) {
				window.openDialog(EzSidebarService.browserURI, '_blank', 'chrome,all,dialog=no', aURI, '', null);
				return;
			}

			var tab = browser.gBrowser.addTab(aURI, getReferrer(document));
			if (!EzSidebarService.getPref('browser.tabs.loadInBackground'))
				browser.gBrowser.selectedTab = tab;
		};


	eval('nsContextMenu.prototype.setTarget = ' +
		nsContextMenu.prototype.setTarget.toSource().replace(
			/(function[^\{]+\{)/,
			'$1\nvar content = window.content;\n'
		)
	);
	eval('nsContextMenu.prototype.viewPartialSource = ' +
		nsContextMenu.prototype.viewPartialSource.toSource().replace(
			/(function[^\{]+\{)/,
			'$1\nvar content = window.content;\n'
		)
	);




	// Reporter用のプログレスリスナのせいでサイドバーを閉じた後に問題が起こるのを回避
	if ('reporterListener' in window) {
		reporterListener.onLocationChange = ezsidebarDummyFunc;
	}
}



function OverrideFunctionsDestruct()
{
	function nullFunc() { return null; }

	window.__proto__.__defineGetter__('_content', nullFunc);
	window.__proto__.__defineGetter__('content', nullFunc);
	window.__proto__.__defineGetter__('_content.frames', nullFunc);

	window.__defineGetter__('_content', nullFunc);
	window.__defineGetter__('content', nullFunc);
	window.__defineGetter__('_content.frames', nullFunc);


	window.__proto__.__defineGetter__('gBrowser', nullFunc);
	window.__proto__.__defineSetter__('gBrowser', nullFunc);
}




function ezsidebarDummyFunc(aValue)
{
}


function ezsidebarGBrowserGetter()
{
	return EzSidebarService.hostWindow ? EzSidebarService.hostWindow.gBrowser :
			!EzSidebarService.windowIsClosing ? window.openDialog(EzSidebarService.browserURI, '_blank', 'chrome,all,dialog=no') :
			null ;
}

function ezsidebarGetContent()
{
	var contentWindow = EzSidebarService.hostWindow;
	if (contentWindow) {
		contentWindow = contentWindow.gBrowser.contentWindow;
	}
	else {
		var b = EzSidebarService.sidebar;
		if (b)
			return b.contentWindow;
		else
			return window;
	}

	try {
		if (contentWindow) {
			contentWindow.framesSelf = contentWindow.frames;

			contentWindow.framesSum = [];
			var i;
			for (i = 0; i < contentWindow.framesSelf.length; i++)
				contentWindow.framesSum.push(contentWindow.framesSelf[i]);
			for (i = 0; i < window.frames.length; i++)
				contentWindow.framesSum.push(window.frames[i]);

			contentWindow.__defineGetter__('frames', function() { return this.framesSum; });
		}
	}
	catch(e) {
	}
	return contentWindow || window ;
}

// _content.frames の isDocumentFrame(frame) は _content.frames の中に与えられたframeが含まれているかどうかを調べるが、Sidebar Windowでは当然エラーになる。その暫定的な対処。
function ezsidebarGetFrames()
{
	var contentWindow = ezsidebarGetContent();
	if (contentWindow) {
		var contentWindowWrapper = new XPCNativeWrapper(contentWindow, 'frames');
		var ret = [],
			i;
		var length = contentWindowWrapper.frames.length;
		for (i = 0; i < length ; i++)
			ret.push(contentWindowWrapper.frames[i]);
		length = window.frames.length;
		for (i = 0; i < length; i++)
			ret.push(window.frames[i]);

		return ret;
	}
	else
		return window.frames;
}

function ezsidebarOverrideContentWindowPointer(aWindow)
{
	aWindow.__proto__.__defineGetter__('_content', ezsidebarGetContent);
	aWindow.__proto__.__defineGetter__('content', ezsidebarGetContent);
	aWindow.__proto__.__defineGetter__('_content.frames', ezsidebarGetFrames);
	aWindow.__defineGetter__('_content', ezsidebarGetContent);
	aWindow.__defineGetter__('content', ezsidebarGetContent);
	aWindow.__defineGetter__('_content.frames', ezsidebarGetFrames);
}
function ezsidebarOverrideContentWindowPointerEventListener(aEvent)
{
	if (aEvent.target.localName == 'browser' &&
		aEvent.target.currentURI.spec.match(/^(about|chrome):/)) {
		ezsidebarOverrideContentWindowPointer(aEvent.target.contentWindow);
	}
	else if (EzSidebarService.sidebar == EzSidebarService.staticSidebar &&
		EzSidebarService.sidebar.currentURI.spec.match(/^(about|chrome):/)) {
		ezsidebarOverrideContentWindowPointer(EzSidebarService.sidebar.contentWindow);
	}
}




window.addEventListener(
	'close',
	function()
	{
		EzSidebarService.windowIsClosing = true;
	},
	false
);





try {
	if (__defineGetter__) {
		__defineGetter__('gBrowser', ezsidebarGBrowserGetter);
		__defineSetter__('gBrowser', ezsidebarDummyFunc);

		__defineGetter__('_content', ezsidebarGetContent);
		__defineGetter__('content', ezsidebarGetContent);
		__defineGetter__('_content.frames', ezsidebarGetFrames);

		__proto__.__defineGetter__('_content', ezsidebarGetContent);
		__proto__.__defineGetter__('content', ezsidebarGetContent);
		__proto__.__defineGetter__('_content.frames', ezsidebarGetFrames);
	}
}
catch(e) {
}

