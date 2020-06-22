        	function initialize() {
	var myLatlng = new google.maps.LatLng(40.758895,-73.985),
	mapOptions = {
		zoom: 13,
		center: myLatlng,
		mapTypeId: google.maps.MapTypeId.ROADMAP
		}
var map = new google.maps.Map(document.getElementById('map'), mapOptions);
var contentString = 'Times Square, Manhattan';
var infowindow = new google.maps.InfoWindow({
	content: contentString,
	maxWidth: 500
});

var marker = new google.maps.Marker({
	position: myLatlng,
	map: map
});

google.maps.event.addListener(marker, 'click', function() {
	infowindow.open(map,marker);
});

google.maps.event.addDomListener(window, "resize", function() {
	var center = map.getCenter();
	google.maps.event.trigger(map, "resize");
	map.setCenter(center);
	});
}
google.maps.event.addDomListener(window, 'load', initialize);