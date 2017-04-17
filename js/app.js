function plusReady(callback) {
	if(window.plus) {
		setTimeout(function() {
			callback();
		}, 0);
	} else {
		document.addEventListener('plusready', function() {
			callback();
		});
	}
}

(function($, self) {
	self.IMAGE_SIZE_SHARE = 20;
	self.IMAGE_SIZE_CATEGORY = 20;
	self.IMAGE_SIZE_PREVIEW = 80;
	self.IMAGE_SIZE_MESSAGE_ICON = 80;
	self.IMAGE_SIZE_AVATAR_PROFILE = 80;
	self.IMAGE_SIZE_PERIOD_LIST = 80;
	self.IMAGE_SIZE_PERIOD_NORMAL = 120;
	self.IMAGE_SIZE_PERIOD_BIG = 320;
	self.IMAGE_SIZE_BANNER = '360x150';

	self.PERIOD_STATUS_NORMAL = 0;
	self.PERIOD_STATUS_DELETED = 1;
	self.PERIOD_STATUS_PARTICIPATABLE = 2;
	self.PERIOD_STATUS_END = 3;
	self.PERIOD_STATUS_ANNOUNCING = 4;
	self.PERIOD_STATUS_ANNOUNCED = 5;

	self.PARTICIPATION_STATUS_IN_PROGRESS = 0;
	self.PARTICIPATION_STATUS_ANNOUNCED = 1;

	self.PARTICIPATION_TYPE_IN_PROGRESS = 1;
	self.PARTICIPATION_TYPE_ANNOUNCED = 2;
	self.PARTICIPATION_TYPE_LUCKY = 3;

	self.timestamp = function() {
		return parseInt((new Date()).valueOf() / 1000);
	}

	// 一定时间内不再重复调用
	var callUntilLasts = {};
	self.callUntil = function(name, expire, fn) {
		if(typeof callUntilLasts[name] == 'undefined') {
			callUntilLasts[name] = self.timestamp();
		}
		if(app.timestamp() - callUntilLasts[name] > expire) {
			callUntilLasts[name] = app.timestamp();
			if(typeof fn == "function") {
				fn();
			}
		}
	}

	self.switchTab = function(tab) {
		var webview = plus.webview.getWebviewById('index');
		webview.evalJS('switchTab("' + tab + '")');
	}


	function cacheSetting(module, value, expire, lazyload) {
		var cache = localStorage.getItem('$cacheSetting') || '{}';
		cache = JSON.parse(cache);
		cache[module] = {
			'value': value,
			'expire': expire,
			'lazyload': lazyload,
			'cachedTime': self.timestamp()
		}
		localStorage.setItem('$cacheSetting', JSON.stringify(cache));
	}

	function getCacheSetting(module) {
		var cache = localStorage.getItem('$cacheSetting') || '{}';
		cache = JSON.parse(cache);
		if(typeof cache[module] != 'undefined') {
			if(cache[module]['lazyload'] && cache[module]['expire'] > self.timestamp() - cache[module]['cachedTime']) {
				return cache[module]['value'];
			}
		}
		return false;
	}

	self.loadSetting = function(modules, cbSuccess, cbError) {
		if(typeof modules == 'string') {
			modules = [modules];
		}

		var cached = notCached = [];
		for(i in modules) {
			var tmp = getCacheSetting(modules[i]);
			if(tmp) {
				cached[modules[i]] = tmp;
			} else {
				notCached.push(modules[i]);
			}
		}
		if(notCached.length == 0) {
			cbSuccess(cached);
			return;
		}

		self.get('https://app.schoolbb.com/Setting/get', {
			modules: notCached
		}, function(data) {
			if(data.code == 0) {
				if(typeof cbSuccess == 'function') {
					var result = [];
					for(k in data.data.setting) {
						cacheSetting(k, data.data.setting[k].value, data.data.setting[k].expire, data.data.setting[k].lazyload);
						result[k] = data.data.setting[k].value;
					}
					cbSuccess(result);
				}
			} else {
				if(typeof cbError == 'function') {
					cbError(data);
				}
			}
		}, function() {
			if(typeof cbError == 'function') {
				cbError(data);
			}
		});
	}

	// 重设图片尺寸
	self.resizeImage = function(imageUrl, size) {
		if(imageUrl.indexOf('-') > 0) {
			imageUrl = imageUrl.substr(0, imageUrl.indexOf('-'));
		}
		if(typeof size == 'number') {
			size = size * plus.screen.scale;
		} else {
			// 360x150
			size = size.split('x');
			size = [size[0] * plus.screen.scale, size[1] * plus.screen.scale].join('x');
		}

		return imageUrl + '-' + size;
	}

	/**
	 * 获取本地是否安装客户端
	 **/
	self.isInstalled = function(id) {
		if(id === 'qihoo' && mui.os.plus) {
			return true;
		}
		if(mui.os.android) {
			var main = plus.android.runtimeMainActivity();
			var packageManager = main.getPackageManager();
			var PackageManager = plus.android.importClass(packageManager)
			var packageName = {
				"qq": "com.tencent.mobileqq",
				"weixin": "com.tencent.mm",
				"sinaweibo": "com.sina.weibo"
			}
			try {
				return packageManager.getPackageInfo(packageName[id], PackageManager.GET_ACTIVITIES);
			} catch(e) {}
		} else {
			switch(id) {
				case "qq":
					var TencentOAuth = plus.ios.import("TencentOAuth");
					return TencentOAuth.iphoneQQInstalled();
				case "weixin":
					var WXApi = plus.ios.import("WXApi");
					return WXApi.isWXAppInstalled()
				case "sinaweibo":
					var SinaAPI = plus.ios.import("WeiboSDK");
					return SinaAPI.isWeiboAppInstalled()
				default:
					break;
			}
		}
	}

	var publicParams = {};

	var request = function(method, url, params, cb_success, cb_error, timeout) {
		if(typeof timeout == 'undefined') {
			timeout = 10000;
		}
		if(typeof params === 'undefined') {
			params = {};
		}
		if(typeof params !== 'object') {
			params = {};
		}

		params = appendPublicParam(params);

		var options = {
			data: params,
			type: method,
			dataType: "json"
		};

		if(timeout) {
			options['timeout'] = timeout;
		}
		if(typeof cb_success === "function") {
			options["success"] = cb_success;
		}

		options["error"] = function(xhr, type, e) {
			self.eventTrigger('http_failed', {
				type: type,
				e: e
			});

			if(typeof cb_error === "function") {
				cb_error(xhr, type, e);
			}
		}

		$.ajax(url, options);
	}

	function appendPublicParam(params) {
		params['_device_id'] = plus.device.uuid;
		params['_device_name'] = plus.device.vendor + '_' + plus.device.model;
		params['_version'] = plus.runtime.version;
		params['_os_name'] = $.os.ios ? 'ios' : ($.os.android ? 'android' : 'unknow');
		params['_os_version'] = $.os.version;
		params['_time'] = (new Date()).valueOf();
		params['_network'] = '' + plus.networkinfo.getCurrentType();

		if($.os.isBadAndroid) {
			params['_bad_android'] = 1;
		}

		for(k in publicParams) {
			params[k] = publicParams[k];
		}
		return params;
	}

	self.addPublicParams = function(params) {
		if(typeof params === 'object') {
			for(k in params) {
				publicParams[k] = params[k];
			}
		}
	}

	self.get = function(url, params, cb_success, cb_error, timeout) {
		request('get', url, params, cb_success, cb_error, timeout);
	}

	self.post = function(url, params, cb_success, cb_error, timeout) {
		request('post', url, params, cb_success, cb_error, timeout);
	}

	self.open = function(url, id, options, cb_success, cb_close) {
		options = typeof options === 'undefined' ? {} : options;
		var styles = typeof options['styles'] === 'object' ? options['styles'] : 　{};
		var showWaiting = typeof options['show_waiting'] === 'boolean' ? options['show_waiting'] : true;

		if(showWaiting) {
			$.showWaiting();
		}
		var exists = plus.webview.getWebviewById(id);
		if(exists) {
			show(exists, options, cb_success, cb_close);
		} else {
			plusReady(function() {
				var webview = plus.webview.create(url, id, styles);
				webview.preopen = true;
				show(webview, options, cb_success, cb_close);
			});
		}
	}

	self.close = function(webview) {
		if(close in webview) {
			webview.close();
		}
	}

	function show(webview, options, cb_success, cb_close) {
		options = typeof options === 'undefined' ? {} : options;
		var styles = typeof options['styles'] === 'object' ? options['styles'] : {};
		var showWaiting = typeof options['showWaiting'] === 'boolean' ? options['showWaiting'] : true;
		var autoClose = typeof options['autoClose'] === 'boolean' ? options['autoClose'] : true;

		if(typeof options === 'function') {
			cb_close = cb_success;
			cb_success = options;
		}

		if(showWaiting) {
			$.closeWaiting();
		}

		isLoaded(webview, function() {

			if(!autoClose) {
				webview.evalJS("mui.plusReady(function(){mui.back=function(){plus.webview.currentWebview().hide();}});");
			}

			webview.show();

			if(typeof cb_success === 'function') {
				cb_success(webview);
			}
			webview.onclose = function() {
				if(typeof cb_close === 'function') {
					cb_close(webview);
				}
				webview = null;
			};
		});
	}

	function isLoaded(webview, callback) {
		if(!webview) {
			return false;
		}
		// 本页打开的webview
		if(webview.preopen) {
			if(webview.loaded) {
				callback();
			} else {
				webview.addEventListener('loaded', function() {
					webview.loaded = true; // 同一个窗口中打开的子页面生效
					callback();
				});
			}
		} else {
			//TODO
			setTimeout(function() {
				callback();
			}, 0);
		}
	}
	$.showWaiting = function(message, options) {
		$.closeWaiting();
		plus.nativeUI.showWaiting(message, options);
	};

	$.closeWaiting = function() {
		plus.nativeUI.closeWaiting();
	}

	$.registerSlider = function() {
		var slider = $('.mui-slider').slider();
		$('.mui-scroll-wrapper.mui-slider-indicator.mui-segmented-control').scroll({
			scrollY: false,
			scrollX: true,
			indicators: false,
			snap: '.mui-control-item'
		});
		return slider;
	};

	$.registerNumbox = function() {
		$('.mui-numbox').numbox();
	}
}(mui, window.app = {}));

if(typeof template !== "undefined") {
	template.helper('stringify', function(data) {
		return JSON.stringify(data);
	});
	template.helper('striptags', function(str) {
		return str.replace(/(<([^>]+)>)/ig, "");
	});
	template.helper('resize', function(imageUrl, size) {
		return app.resizeImage(imageUrl, size);
	});
	template.helper("date", dateFormat);
}

/** 
 * 对日期进行格式化，
 * @param date 要格式化的日期
 * @param format 进行格式化的模式字符串
 *     支持的模式字母有：
 *     y:年,
 *     M:年中的月份(1-12),
 *     d:月份中的天(1-31),
 *     h:小时(0-23),
 *     m:分(0-59),
 *     s:秒(0-59),
 *     S:毫秒(0-999),
 *     q:季度(1-4)
 * @return String
 */
function dateFormat(date, format) {
	if(date == null) {
		return '';
	}
	date = date.substring(0, 19);
	date = date.replace(/-/g, '/');
	date = new Date(date);
	var map = {
		"M": date.getMonth() + 1, //月份 
		"d": date.getDate(), //日 
		"h": date.getHours(), //小时 
		"m": date.getMinutes(), //分 
		"s": date.getSeconds(), //秒 
		"q": Math.floor((date.getMonth() + 3) / 3), //季度 
		"S": date.getMilliseconds() //毫秒 
	};

	format = format.replace(/([yMdhmsqS])+/g, function(all, t) {
		var v = map[t];
		if(v !== undefined) {
			if(all.length > 1) {
				v = '0' + v;
				v = v.substr(v.length - 2);
			}
			return v;
		} else if(t === 'y') {
			return(date.getFullYear() + '').substr(4 - all.length);
		}
		return all;
	});
	return format;
}

