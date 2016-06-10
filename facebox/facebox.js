/*  Proto-Facebox version 1.2
 *  By Dennis Crall, http://github.com/dcrall
 *  @requires Prototype 1.6 & script.aculo.us 1.8

 *  Inspired by the original, Facebox by Chris Wanstrath - http://famspam.com/facebox
 *  First ported to Prototype by Phil Burrows - http://blog.philburrows.com
 *  Forked from Scott Davis http://github.com/jetviper21/prototype-facebox
 *  Additional forks at: http://github.com/robertgaal/facebox-for-prototype
 *
 *  Why another Facebox for Prototype?
 *    - Better feature parity with Facebox (for JQuery) v1.2
 *    - Written in idiomatic Prototype for better readability
 *
 *  Licensed under the MIT:
 *  http://www.opensource.org/licenses/mit-license.php
 *
 *  Usage:
 *   
 *  var facebox;
 *  document.observe('dom:loaded', function(e) {
 *  	facebox = new Facebox();		
 *	});
 *
 *  Customize settings by passing in a configuration object:
 *
 *  facebox = new Facebox({
 *      click_away: true,
 *      opacity: .5
 *  });		
 *
 *  Attach to mark-up unobtrusively using rel="facebox"
 *
 *  <a href="#terms" rel="facebox">Terms</a>
 *    Loads the #terms div in the box
 *
 *  <a href="terms.html" rel="facebox">Terms</a>
 *    Loads the terms.html page in the box
 *
 *  <a href="terms.png" rel="facebox">Terms</a>
 *    Loads the terms.png image in the box
 *
 *  <a href="#terms" rel="facebox.style-hook">Terms</a>
 *    Add class "style-hook" to $('facebox_content')
 *
 *  Use the display() method programmatically:
 *
 *    facebox.display({div: '#terms'})
 *    facebox.display({image: 'terms.gif'})
 *    facebox.display({ajax: 'terms.html'})
 *    facebox.display('some html', 'my-groovy-style')
 *
 *  Custom Events
 *    facebox:close			Close the facebox pop-up  
 *    facebox:init			Called as Facebox starts its initialize method  
 *    facebox:loading		Called as the loading sequence starts  
 *    facebox:beforeReveal	Called before content is revealed  
 *    facebox:reveal		Called after content is revealed  
 *    facebox:afterReveal	Alias for facebox:reveal
 *
 *  Trigger custom event: 
 *
 *    $('facebox').fire('facebox:loading');
 *
 *  Observe custom event:
 *
 *    document.observe('facebox:loading', function(e) {
 *	      console.log("Loading Facebox.");
 *    });
 * 
 */

var Facebox = Class.create({
	
	settings: {
			opacity			: 0,
			overlay			: true,
			click_away		: false,
			fade_duration	: .1,
			v_margin_divisor: 10,
			loading_image	: '/facebox/images/loading.gif',
			close_image		: '/facebox/images/closelabel.gif',
			image_types		: ['png', 'jpg', 'jpeg', 'gif'],	
			facebox_html	: new Template('\
	  <div id="facebox" style="display:none;"> \
	    <div class="popup"> \
	      <table> \
	        <tbody> \
	          <tr> \
	            <td class="tl"/><td class="b"/><td class="tr"/> \
	          </tr> \
	          <tr> \
	            <td class="b"/> \
	            <td class="body"> \
	              <div class="content" id="facebox_content"> \
	              </div> \
	              <div class="footer"> \
	                <a href="#" class="close"> \
	                  <img src="#{close_image}" title="close" class="close_image" /> \
	                </a> \
	              </div> \
	            </td> \
	            <td class="b"/> \
	          </tr> \
	          <tr> \
	            <td class="bl"/><td class="b"/><td class="br"/> \
	          </tr> \
	        </tbody> \
	      </table> \
	    </div> \
	  </div>'),
			faceboxMarkup: function() {
				return this.facebox_html.evaluate({ close_image: this.close_image});
			}
	},
		
	initialize: function(configuration){
		
		document.fire('facebox:init');
		
		if(configuration) Object.extend(this.settings, configuration);
		
		if ($('facebox')) $('facebox').remove();
		$$('body').first().insert({bottom: this.settings.faceboxMarkup()});
		
		this.preload = [];
		this.preloadImage(this.settings.close_image);
		this.preloadImage(this.settings.loading_image);
		
		$('facebox').select('.b:first-of-type, .bl').each(function(elem) {			
			var img_url = elem.getStyle('background-image').replace(/url\((.+)\)/, '$1');
			img_url = img_url.replace('"', '').replace('"', '');
			this.preloadImage(img_url);
		}.bind(this));
		
		$$('a[rel*=facebox]').invoke('observe', 'click', function(e) {
			this.triggerFacebox(e)
		}.bindAsEventListener(this));
		
		$$('#facebox .close,').invoke('observe', 'click', function(e) {
			Event.stop(e);
			this.close();
		}.bindAsEventListener(this))
		
		$$('#facebox .close_image').invoke('writeAttribute', 'src', this.settings.close_image);
		
		Event.observe(window, 'resize', function(e){
			this.setLocation();
		}.bindAsEventListener(this));
		
		document.observe('keyup', function(e) { 
			if(e.keyCode == Event.KEY_ESC) $('facebox').fire('facebox:close');
		}.bindAsEventListener(this));
		
		document.observe('facebox:close', function(e) {
			this.close();
		}.bindAsEventListener(this));
	},
	
	display: function(data, klass) {
		if (data.ajax) this.fillFaceboxFromAjax(data.ajax, klass);
	    else if (data.image) this.fillFaceboxFromImage(data.image, klass);
	    else if (data.div) this.fillFaceboxFromHref(data.div, klass);
		else if (Object.isFunction(data)) data.call();
		else this.reveal(data, klass);
	},
	
	triggerFacebox: function(e){
		Event.stop(e);
		this.loading();
		var elem = Event.element(e);
		
		// supports rel="facebox.popup" syntax, or the deprecated "facebox[.popup]" syntax
		var klass = elem.rel.match(/facebox\[?\.(\w+)\]?/)
		if (klass) klass = klass[1];
		
		if (elem.href.match(/#/)){
			this.fillFaceboxFromHref(elem.href, klass);
			
		} else if(this.isImage(elem.href)) {
			this.fillFaceboxFromImage(elem.href, klass);
				
		} else {
			this.fillFaceboxFromAjax(elem.href, klass);
		}
	},
	
	fillFaceboxFromHref: function(href, klass) {
		var target = href.split('#')[1];
		var data = $(target).clone(true);			
		this.reveal(data, klass);
	},
	
	fillFaceboxFromImage: function(href, klass) {
		var fb = this;
		var image = new Image();
		image.onload = function(e) {
			fb.reveal('<div class="image"><img src="' + image.src + '" /></div>', klass)
		};
		image.src = href;
	},
	
	fillFaceboxFromAjax: function(url, klass){
		
		var fb = this;
		
		new Ajax.Request(url, {
			method		: 'get',
			onFailure	: function(transport){
				console.log("AJAX Call to url failed: " + url);
				this.reveal('<p>Could not load remote resource.</p>', klass);
			}.bind(this),
			onSuccess	: function(transport){
				this.reveal(transport.responseText, klass);
				$$('div#facebox a[rel*=facebox]').invoke('observe', 'click', function(e) {
					this.triggerFacebox(e)
				}.bindAsEventListener(fb));				
			}.bind(this)
		});
	},
		
	loading: function() {
		if($('facebox_loading') && $('facebox').visible()) return true;
		
		$('facebox').fire('facebox:loading');
		this.showOverlay();
		
		var loading_template = new Template(
			'<div id="facebox_loading" class="loading"><img src="#{img}"/></div>'
		);
		
		$('facebox_content').update(loading_template.evaluate({
			img: this.settings.loading_image
		}));
		
		this.setLocation();
		this.open();		
	},
	
	reveal: function(data, klass){
		this.loading();
		$('facebox').fire('facebox:beforeReveal');
				
		var faceboxContent = $('facebox_content');
		if (klass) faceboxContent.addClassName(klass);
		faceboxContent.update(data);
				
		$$('#facebox .loading').invoke('remove');
		$('facebox_content').childElements().invoke('show');
		
		this.setLocation();
		this.open();		
					
		$('facebox').fire('facebox:reveal');
		$('facebox').fire('facebox:afterReveal');
	},
	
	open: function(){
		if(!$('facebox').visible()) {
			$('facebox').appear({duration: this.settings.fade_duration});
		}
	},
	
	close: function(){
		this.hideOverlay();
		new Effect.Fade('facebox', {duration: this.settings.fade_duration});
	},
			
	setLocation: function(){
		var pageScroll = document.viewport.getScrollOffsets();
		var vertical_margin = pageScroll.top + (document.viewport.getHeight()/ this.settings.v_margin_divisor);
		var left_offset = (document.viewport.getWidth()/2) - ($('facebox').getWidth()/2);
		
		$('facebox').setStyle({
			'top': vertical_margin + 'px',
			'left': left_offset + 'px'
		});
	},
				
	showOverlay: function() {
		if(this.skipOverlay()) return;
		
		if(!$('facebox_overlay')) {
			var overlay_html = '<div id="facebox_overlay" class="facebox_hide"></div>' 
			$$('body').first().insert({bottom: overlay_html});
			$('facebox_overlay').addClassName('facebox_overlayBG')
								.setOpacity(this.settings.opacity)
								.show();

			$('facebox_overlay').observe('click', function(e) {
				if(this.settings.click_away) $('facebox_overlay').fire('facebox:close');
			}.bindAsEventListener(this));
		}
		return false;
	},
	
	hideOverlay: function() {
		if(!$('facebox_overlay') || this.skipOverlay()) return;

		$('facebox_overlay').removeClassName('facebox_overlayBG')
							.addClassName('facebox_hide')
							.remove();
		return false;
	},
	
	skipOverlay: function() {
		return this.settings.overlay == false || this.settings.opacity === null;
	},
	
	isImage: function(href) {
		var imagePattern = new RegExp('\.' + this.settings.image_types.join('|') + '$', 'i');
		return href.match(imagePattern);
	},
	
	preloadImage: function(src) {
		var img = new Image();
		img.src = src;
		this.preload.push(img);
		return img;
	} 
});
