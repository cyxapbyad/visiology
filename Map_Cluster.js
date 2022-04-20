// Проверяем не пустой ли контейнер с картой, что б не было ошибки, если не пустой очищаем.
var container = L.DomUtil.get(w.general.renderTo);
//var markerIcon = new LeafIcon({iconUrl: 'custom\marker-icon.png'})
if(container !== null){ container._leaflet_id = null; }

//задаем настрйоки слоя карты
var osmLayer = new L.TileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {// ссылка на карту
     maxZoom: 15, // максимальный зум
     minZoom: 2,// минимальный зум
 });

//отрисовываем карту
var map = new L.Map(w.general.renderTo, {
    center: [55.7522, 37.6156], // задаем координаты центра карты
    zoom: 10, // задаем начальный зум
    layers: osmLayer // слой карты
});

var markers = L.markerClusterGroup({showCoverageOnHover: false,})

for (var i = 0; i < w.data.rows.length; i++){
    markers.addLayer(L.marker([parseFloat(w.data.rows[i][1]), parseFloat(w.data.rows[i][2])],{iconUrl: 'custom\marker-icon.png'})
    .bindPopup(`Аптека ${w.data.rows[i][0].bold()} по адресу: ${w.data.rows[i][3]}`))
//    .openPopup();
// var circle = L.circleMarker([parseFloat(w.data.values[1][i]), parseFloat(w.data.values[2][i])], {
//     color: 'red',
//     fillColor: '#f03',
//     fillOpacity: 0.5,
//     radius: 30,
// }).bindTooltip(w.data.rows[i][0]+' '+w.data.values[0][i]+' т. долл.').addTo(map);
}

map.addLayer(markers);