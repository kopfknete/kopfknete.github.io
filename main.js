/*global variables*/

var baseTite = document.title;
var currChart = "";
var currRel = "USDT";
var currPair = "";
var defaultRange = "1y";
var range = defaultRange;
var showAverage = false;
var avgPeriod;
var avgPeriodStr;
var period; // number of seconds
var pairsToLoad = [];
var startTimestamp;
var pairsData = {};
var marketCapData = {};

/*end global variables*/


var currencies = {
	"USDT": {"shortName": "$", "longName": "Tether Dollar", "showChartButton": false},
	"BTC": {"shortName": "BTC", "longName": "Bitcoin Core", "showChartButton": true, "compareTo": ["USDT"], "color": "#F4911F"},
	"ETH": {"shortName": "ETH", "longName": "Ethereum", "showChartButton": true, "compareTo": ["USDT", "BTC"], "color": "#7B7B7B"},
	"BCH": {"shortName": "BCH", "longName": "Bitcoin Cash", "showChartButton": true, "compareTo": ["USDT", "BTC"], "color": "#4CC947"},
	"XRP": {"shortName": "XRP", "longName": "Ripple", "showChartButton": false, "color": "#102B3E"},
	"LTC": {"shortName": "LTC", "longName": "Litecoin", "showChartButton": true, "compareTo": ["USDT", "BTC", "XMR"], "color": "#88CBF5"},
	//~ "ADA": {"shortName": "ADA", "longName": "Cardano", "showChartButton": false, "color": "#0A1C2A"}, // not available on Poloniex
	//~ "IOTA": {"shortName": "IOTA", "longName": "IOTA", "showChartButton": false, "color": "#041816"}, // not available on Poloniex
	"DASH": {"shortName": "DASH", "longName": "Dash", "showChartButton": true, "compareTo": ["USDT", "BTC", "XMR"], "color": "#1C75BC"},
	//~ "XEM": {"shortName": "XEM", "longName": "NEM", "showChartButton": false, "color": "#211F33"}, // not available on Poloniex
	"XMR": {"shortName": "XMR", "longName": "Monero", "showChartButton": true, "compareTo": ["USDT", "BTC"], "color": "#E05600"},
	"ETC": {"shortName": "ETC", "longName": "Ethereum Classic", "showChartButton": true, "compareTo": ["USDT", "BTC", "ETH"], "color": "#669073"}
};
var ranges = {
	"2d": 2,
	"1w": 7,
	"2w": 14,
	"1m": 30,
	"3m": 365 / 4,
	"6m": 365 / 2,
	"1y": 365,
	"2y": 365 * 2,
	"4y": 365 * 4
};


function setUseUtc(useUtc) {
	Highcharts.setOptions({
		global: {
			useUTC: useUtc
		}
	});
}

function getBaseChartData() {
	var xAxisFormat;
	if(ranges[range] <= 7)
		xAxisFormat = "{value:%a %H:%M}";
	else if(ranges[range] <= 365)
		xAxisFormat = "{value:%b %e}";
	else
		xAxisFormat = "{value:%Y %b}";
			
	var chartData = {
		chart: {
			renderTo: "ChartContainer",
			animation: false,
			style: {
				fontFamily: "Noto Sans, serif"
			}
		},
		title: {
			y: 30
		},
		subtitle: {
		},
		xAxis: {
			type: "datetime",
			labels: {
				format: xAxisFormat
			}
		},
		yAxis: {
			labels: { },
			crosshair: true
		},
		tooltip: { },
		plotOptions: {
			line: {
				animation: false,
				marker: {
					enabled: false
				}
			},
			area: { }
		},
		navigator: {
			enabled: false
		},
		rangeSelector: {
			enabled: false
		},
		scrollbar: {
			enabled: false
		},
		credits: {
			enabled: false
		},
		legend: {
			verticalAlign: 'top',
			y: 65,
			margin: 10
		},
	};
	if(period < 60*60*24)
		chartData.tooltip.xDateFormat = "%a, %Y-%m-%d %H:%M";
	else
		chartData.tooltip.xDateFormat = "%a, %Y-%m-%d";
	
	return chartData;	
}

function showChartCurrency() {
	//var unit = currencies[currRel].shortName + "/" + currencies[currChart].shortName;
	var unit = currencies[currRel].shortName + "/" + currencies["BTC"].shortName;

	// prepare data:
	var series = {
		name: unit,
		data: []
	}
	var data = pairsData[currPair];
	for(var i in data) {
		series.data.push([data[i]["date"] * 1000, data[i].weightedAverage]);
	}
	
	var decimals = getUserfulNumberOfDecimals(series.data);
	var lastValue = data[data.length - 1]["close"];
	var lastValueStr = "<span style=\"color:white;\">" + formatFloat(lastValue, decimals) + "</span> " + unit;
	document.title = formatFloat(lastValue, decimals) + " " + unit + " – " + range + " – " + baseTite;
	var chartData = getBaseChartData();
	chartData.type = "line";
	chartData.yAxis.type = "logarithmic";	
	chartData.yAxis.labels.format = "{value:." + Math.max(decimals - 1, 0) + "f} " + unit;
	chartData.yAxis.offset = 80; // width in pixels
	chartData.tooltip.pointFormat = "<span style=\"color:{series.color}\">\u25CF</span> {point.y:." + decimals + "f} {series.name}<br>";		

	chartData.title.text = currencies[currChart].longName;
	if(currRel != "USDT")
		chartData.title.text = chartData.title.text + " / " + currencies[currRel].longName;
	
	chartData.subtitle.text = "latest: " + lastValueStr;

	// Add average series:
	var avgSeries;
	if(showAverage) {
		avgSeries = {
			name: unit + " (" + avgPeriodStr + " average)",
			data: calculateAverage(series.data, avgPeriod),
			lineWidth: 1.5
		}		
		var avgLastValue = avgSeries.data[avgSeries.data.length - 1][1];
		var avgLastValueStr = "<span style=\"color:white;\">" + formatFloat(avgLastValue, decimals) + "</span> " + unit;
		chartData.subtitle.text = avgPeriodStr + " average: " + avgLastValueStr + " | " + chartData.subtitle.text;
	}	
	
	var chart = new Highcharts.StockChart(chartData);
	chart.addSeries(series);
	if(showAverage)	
		chart.addSeries(avgSeries);
}


function loadPriceDataIteration() {
	var pair = pairsToLoad.pop();
	//var pair = "USDT_BTC"
	var url = "https://poloniex.com/public?command=returnChartData&currencyPair=BTC_XMR&start=1405699200&end=9999999999&period=14400"
	//var url = "https://poloniex.com/public?command=returnChartData&currencyPair=" + pair + "&start=" + startTimestamp + "&end=9999999999&period=" + period;
	$.ajax(url).done(function(data) {
		if(data["error"]) {
			document.getElementById("ChartContainer").innerHTML = "<div class=\"error\">" + data["error"] + "</div>";
			document.getElementById("loading").style.display = "none";
			document.title = baseTite;
			alert(data["error"])
			return;
		}
		pairsData[pair] = data;
		if(pairsToLoad.length == 0)
			showChartCurrency();
		else
			loadPriceDataIteration();
	});	
}


setUseUtc(period >= 60*60*24);

//startTimestamp = Math.round((new Date().getTime() / 1000) - ranges[range] * 24 * 60 * 60);

currRel = "USDT"
		currChart = "BTC"
	currPair = currRel + "_" + currChart;
	pairsToLoad = [currPair];
	loadPriceDataIteration();
/*
if(currChart == "") {
	pairsToLoad = [];
	for(var cur in currencies) {
		if(cur != "USDT")
			pairsToLoad.unshift("USDT_" + cur);
	}
	loadPriceDataIteration();
	//loadMarketCapData();
} else {
	currRel = "USDT"
		currChart = "BTC"
	currPair = currRel + "_" + currChart;
	pairsToLoad = [currPair];
	loadPriceDataIteration();
}
*/
function getUserfulNumberOfDecimals(rows) {
	if(rows.length == 0)
		return 0;
	var minValue = rows[0][1];
	var maxValue = rows[0][1];
	for(var i = 1; i < rows.length; i++)
	{
		var val = rows[i][1];
		if(minValue > val)
			minValue = val;
		if(maxValue < val)
			maxValue = val;
	}
	var diff = maxValue - minValue;
	if(diff == 0)
		return 0;
	var decimals = 0;
	while(diff < 50) {
		diff = diff * 10;
		decimals++;
	}
	return decimals;
}

function formatFloat(value, decimals) {
	var f = Math.pow(10, decimals);
	return Math.round(value * f) / f;
}
