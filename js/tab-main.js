var lazyloads = {};
var periods = {};
var currentTab = 'hot';
var currentCategory = 0;
var lasts = {};
mui.init({
	keyEventBind: {
		backbutton: false
	},
	pullRefresh: {
		container: '#main',
		down: {
			contentdown: "看看最新内容",
			contentover: "松开即可刷新",
			contentrefresh: "正在刷新...",
			callback: function() {
				loadList(currentTab, false, function() {
					mui('#main').pullRefresh().endPulldownToRefresh();
				}, function() {
					mui('#main').pullRefresh().endPulldownToRefresh();
				});
				app.callUntil('show', 10, function() {
					loadShow();
				});
				app.callUntil('lucky', 10, function() {
					loadLucky();
				});
			}
		},
		up: {
			contentrefresh: '正在加载...',
			callback: function() {
				loadList(currentTab, true, function(data) {
					mui('#main').pullRefresh().endPullupToRefresh(!data.more);
					if(!data.more) {
						setTimeout(function() {
							mui('#main').pullRefresh().disablePullupToRefresh();
							setTimeout(function() {
								mui('#main').pullRefresh().refresh(true);
							}, 1000);
						}, 3000);
					}
				}, function() {
					mui('#main').pullRefresh().endPullupToRefresh(true);
				});
			}
		}
	}
});
mui.plusReady(function() {
	loadBanner();
	loadShow();
	loadLucky();
	loadList(currentTab);
});

mui('#segmentedControl').on('tap', '.mui-control-item', function(event) {
	var t = this;
	if(currentTab == t.dataset['type']) {
		return;
	}
	currentTab = t.dataset['type'];
	var target = document.getElementById(t.dataset['type']);
	if(typeof target.dataset['offset'] !== 'undefined' && currentCategory != 0 && target.dataset['category'] == currentCategory) {
		return;
	}
	loadList(t.dataset['type']);
});

window.addEventListener('scroll2top', function() {
	mui.scrollTo(0, 100);
});

function loadList(type, append, callback, errorcb) {
	mui.closeWaiting();
	var targetId = type;
	var target = document.getElementById(targetId);

	var params = {
		type: type
	};
	if(currentCategory != 0) {
		params['category_id'] = currentCategory;
	}
	if(append === true && typeof target.dataset['offset'] !== 'undefined') {
		params['offset'] = target.dataset['offset'];
	}
	if(!target.dataset['offset']) {
		mui.showWaiting("正在加载中...", {
			modal: false,
			padlock: true
		});
	}

	app.get('https://app.schoolbb.com/Period/list', params, function(data) {
		if(data.code != 0) {
			target.children[0].innerHTML = template('tpl_bad_network', {});
			if(typeof callback === 'function') {
				callback(data.data);
			}
			return false;
		}
		mui('#main').pullRefresh().refresh(true);
		for(i in data.data.list) {
			periods[data.data.list[i]['id']] = data.data.list[i];
		}
		if(!target.dataset['offset']) {
			plus.nativeUI.closeWaiting();
		}
		var html = template('tpl-period', {
			data: data.data,
			app: app
		});
		if(append) {
			target.children[0].innerHTML += html;
		} else {
			target.children[0].innerHTML = html;
		}
		target.dataset['offset'] = data.data.offset;
		if(lazyloads[targetId]) {
			lazyloads[targetId].destroy();
		}
		setTimeout(function() {
			lazyloads[targetId] = mui('#' + targetId).imageLazyload({
				placeholder: 'images/loading.gif',
				autoDestroy: false
			});
		}, 100);
		if(typeof callback === 'function') {
			callback(data.data);
		}
	}, function(e) {
		if(!target.dataset['offset']) {
			plus.nativeUI.closeWaiting();
		}
		target.children[0].innerHTML = template('tpl_bad_network', {});
		mui('#main').pullRefresh().disablePullupToRefresh();
		if(typeof errorcb === 'function') {
			errorcb(e);
		}
	});
}

function loadShow() {
	app.get('https://app.schoolbb.com/Show', {}, function(data) {
			if(data.code == 0) {
				if(data.data.list.length > 4) {
					data.data.list = data.data.list.slice(0, 4);
				}
				if (typeof data.data.list == 'undefined' || data.data.list.length == 0){
					return ;
				}
				var html = template('tpl-show', {data: data.data, app: app});
				document.getElementById("box-show").innerHTML = html;
			}
		},
		function() {
			setTimeout(function() {
				loadShow();
			}, 5000)
		});
}

function loadLucky() {
	app.get('https://app.schoolbb.com/Period/lucky', {}, function(data) {
			if(data.code == 0) {
				var html = template('tpl-lucky', {data: data.data, app: app});
				document.getElementById("box-lucky").innerHTML = html;
			}
		},
		function() {
			setTimeout(function() {
				loadLucky();
			}, 5000)
		});
}

function loadBanner() {
	app.loadSetting('banner_index', function(value) {
		if (typeof value !== 'object'){
			return;
		}
		if (typeof value.banner_index === 'undefined'){
			return;
		}
		value = value['banner_index'];
		var html = template('tpl_slider', {
			banners: value,
			length: value.length,
			first: value[0],
			last: value[value.length - 1],
			app: app
		});
		document.getElementById("wrapper-slider").innerHTML = html;
		mui("#slider").slider({
			interval: 5000
		});
	}, function(){
		setTimeout(function(){
			loadBanner();
		}, 5000);
	});
}
