/*
 *  jQuery JIT image v1.2 - jQuery plugin
 *
 *  Copyright (c) 2013-2014 Deux Huit Huit (http://www.deuxhuithuit.com/)
 *  Licensed under the MIT LICENSE
 *  (https://raw.github.com/DeuxHuitHuit/jQuery-jit-image/master/LICENSE.txt)
 */
(function ($, defaultSelector, dataAttribute, undefined) {
	
	'use strict';
	
	// assure param values
	dataAttribute = dataAttribute || 'data-src-format';
	defaultSelector = defaultSelector || 'img[' + dataAttribute + ']';
	$.fn.on = $.fn.on || $.fn.bind;
	$.fn.off = $.fn.off || $.fn.unbind;
	
	var win = $(window);
	
	var instances = $();
	
	var DATA_KEY = 'jitImageOptions';
	
	var loader = (function createLoader() {
		var queue = [];
		var active = 0;
		
		var checkTimeout = 0;
		
		var processQueue = function () {
			while (!!queue.length && active < queue[0].limit) {
				var cur = queue.shift();
				active++;
				cur.update();	
			}
			checkTimeout = 0;
		};
		
		var checkQueue = function () {
			if (!checkTimeout) {
				checkTimeout = setTimeout(processQueue, 0);
			}
		};
		
		var push = function (job) {
			var found = false;
			$.each(queue, function (index, j) {
				// elem is already in the queue
				if (j.elem.is(job.elem)) {
					// replace old job with new one
					queue[index] = job;
					found = true;
					return found;
				}
			});
			if (!found) {
				queue.push(job);
			}
			checkQueue();
		};
		
		var done = function (elem, args) {
			if (active > 0) {
				active--;
				checkQueue();
			}
		};
		
		return {
			push: push,
			done: done,
			check: checkQueue,
			count: function () {
				return queue.length;
			},
			active: function () {
				return active;
			},
			queue: function () {
				return queue;	
			}
		};
	})();
	
	var _getSize = function (o) {
		return {
			width: o.container.width(),
			height: o.container.height()
		};
	};
	
	/*jshint maxparams:6 */
	var _set = function (t, size, url, forceCssResize, callback, parallelLoadingLimit) {
		if (!!t && !!size) {
			if (!!forceCssResize && !!size.width) {
				t.attr('width', size.width).width(size.width);
			} else {
				t.removeAttr('width').width('');
			}
			
			if (!!forceCssResize && !!size.height) {
				t.attr('height', size.height).height(size.height);
			} else {
				t.removeAttr('height').height('');
			}
			
			var callbackCreator = function (err) {
				return function (e) {
					var args = [size, e, err];
					if (!!parallelLoadingLimit) {
						loader.done(t, args);
					}
					if ($.isFunction(callback)) {
						callback.apply(t, args);
					}
					t.trigger('loaded.jitImage', args);
				};
			};
			
			if (!!url && t.attr('src') !== url) {
				// register for load
				t.off('load.jitImage')
					.off('error.jitImage')
					.one('load.jitImage', callbackCreator(false))
					.one('error.jitImage', callbackCreator(true));
				// load it
				t.attr('src', url);
			}
		}
	};
	
	var _getUrlFromFormat = function (t, o, size) {
		var format = t.attr(o.dataAttribute);
		var urlFormat = {
			url: format,
			height: false,
			width: false,
			formatted: false
		};
		if (!!format) {
			urlFormat.width = o.widthPattern.test(format);
			urlFormat.height = o.heightPattern.test(format);
			if (urlFormat.width) {
				format = format.replace(o.widthPattern, ~~size.width);
			}
			if (urlFormat.height) {
				format = format.replace(o.heightPattern, ~~size.height);
			}
			urlFormat.url = format;
			urlFormat.formatted = urlFormat.width || urlFormat.height;
		}
		return urlFormat;
	};
	
	var _update = function (t, o) {
		if (!!o && !!t) {
			var size = o.size(o);
			var urlFormat = _getUrlFromFormat(t, o, size);
			var urlFormatSuccess = !!urlFormat && !!urlFormat.url;
			var sizeSucces = !!size && (size.height > 0 || size.width > 0);
			
			if (urlFormatSuccess && sizeSucces) {
				// fix for aspect ratio scaling
				// Only pass the size value if it was matched
				size.width = urlFormat.width ? size.width : false;
				size.height = urlFormat.height ? size.height : false;
				// set the image's url and css
				o.set(t, size, urlFormat.url, o.forceCssResize, o.load, o.parallelLoadingLimit);
			}
		}
	};
	
	var _updateAll = function () {
		$.each(instances, function _resize(index, element) {
			var $el = $(element);
			var data = $el.data(DATA_KEY);
			var visible = $el.is(':visible');
			var update = function () {
				_update($el, data);
			};
			
			if (!data) {
				return;
			}
			
			// No limit
			if (!data.parallelLoadingLimit) {
				// cancel any pending timeouts
				clearTimeout(data.jitTimeout);
				
				if (!!_defaults.nonVisibleDelay && !visible) {
					data.jitTimeout = setTimeout(update, _defaults.nonVisibleDelay);
				} else {
					update();
				}
			}
			// Limit concurents image loading
			else {
				loader.push({
					elem: $el,
					visible: visible,
					update: update,
					limit: data.parallelLoadingLimit
				});
			}
		});
		// re-register event
		//setTimeout(_registerOnce, _defaults.eventTimeout);
		_registerOnce();
	};
	
	var eventTimer = null;
	
	var updateOnEvent = function (e) {
		clearTimeout(eventTimer);
		eventTimer = setTimeout(_updateAll, _defaults.eventTimeout);
	};
	
	var _defaults = {
		container: null,
		dataAttribute: dataAttribute,
		defaultSelector: defaultSelector,
		containerDataAttribute: 'data-container',
		size: _getSize,
		set: _set,
		widthPattern: /\$w/i,
		heightPattern: /\$h/i,
		updateEvents: 'resize orientationchange',
		eventTimeout: 50,
		load: $.noop,
		nonVisibleDelay: 1000,
		forceCssResize: true,
		parallelLoadingLimit: 0
	};
	
	var _registerOnce = function () {
		win.one(_defaults.updateEvents, updateOnEvent);
	};
	
	$.jitImage = {
		remove: function (t) {
			instances = instances.not(t);
		},
		defaults: _defaults,
		_getSize: _getSize,
		_set: _set,
		_getUrlFromFormat: _getUrlFromFormat,
		loader: loader
	};
	
	$.fn.jitImage = function (options) {
		var t = $(this);
		
		var _each = function (index, element) {
			var t = $(element);
			// resuse old options if they exists
			var oldOptions = t.data(DATA_KEY) || {};
			var o = $.extend({}, _defaults, oldOptions, options);
			
			var container = t.attr(o.containerDataAttribute);
			var parentContainer = !!container ? 
					t.closest(container) : 
					!t.parent().length ? t : t.parent();
					
			// insure container
			// do it here since elements may have
			// different parents
			o.container = !!o.container ? $(o.container) : parentContainer;
							
			// save options
			t.data(DATA_KEY, o);
			
			var update = function () {
				_update(t, o);	
			};
			
			// No limit
			if (!o.parallelLoadingLimit) {
				// update attributes
				update();
			}
			// Limit concurents image loading
			else {
				loader.push({
					elem: t,
					visible: true,
					update: update,
					limit: o.parallelLoadingLimit
				});
			}
		};
		
		// flatten our element array
		instances = instances.add(t);
		
		// hook up each element
		return t.each(_each);
	};
	
	// Use data attribute to automatically hook up nodes
	win.load(function init() {
		if (!!_defaults.defaultSelector) {
			$(_defaults.defaultSelector).jitImage();
		}
		_registerOnce();
	});
	
})(jQuery, window.jitImageSelector, window.jitImageDataAttribute);