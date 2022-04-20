;(function() {

    /**
     @typedef Coordinate
     @type {object}
     @property {number} latitude - широта
     @property {number} longitude - долгота
     /

     /**
     @typedef Cluster
     @type {object} кастеризация точек. Если включена, то будет выключено выделение точек
     @property {boolean} enabled - вкл/выкл
     @property {number} radius - радиус точек
     @property {string} color - цвет точек
     @property {string} font - шрифт текста в точке
     @property {number} strokeWidth - ширина обводки
     @property {string} strokeColor - цвет обводки
     @property {string} textColor - цвет текст в точке
     @property {number} distance - дистанция объединения точек
     /

     /**
     @typedef Tooltip
     @type {object} подсказка
     @property {boolean} enabled - вкл/выкл
     @property {string} html - текст в подсказке в виде html или обычного текста
     /

     /**
     @typedef Point
     @type {object}
     @property {string} latitude - широта
     @property {string} longitude - долгота
     @property {number} color - цвет точки
     @property {boolean} isSelected - выделена точка или нет. По умолчанию выделены все точки
     @property {number} strokeWidth - толщина обводки
     @property {number} radius - радиус точки
     @property {Tooltip} tooltip - подсказка
     /

     /**
     @typedef Line
     @type {object}
     @property {Coordinate} from - откуда построить линию
     @property {Coordinate} to - докуда построить линию
     @property {string} color - цвет линии
     @property {number} width - толщина линии
     /

     /**
     @typedef Options
     @type {object}
     @property {string} renderTo - ID DOM обьекта куда нужно отрисовать карту
     @property {string} defaultZoom - zoom по-умолчанию
     @property {Coordinate} center - центр карты
     @property {Point[]} points - точки
     @property {Line[]} points - линии
     @property {Cluster} cluster - настройки кластеризация
     @property {function(Point, boolean)} onPointClickListeners - подписка на клик по точке. Отдает точку и isSelected
     @property {function()} onMapClickListeners - подписка на клик по карте. Все выделения точек сбросятся
     */

    let defaultOptions = {
        renderTo: "widgetId",
        defaultZoom: 3,
        center: { // Москва
            latitude: 55.751244,
            longitude: 37.618423,
        },
        cluster: {
            enabled: false,
            radius: 20,
            color: 'rgba(77,135,254,0.7)',
            font: '15px Arial',
            strokeWidth: 1,
            strokeColor: '#fff',
            textColor: '#fff',
            distance: 10
        },
        points: [],
        lines: [],
        onPointClickListeners: function(point, isSelected) {

        },
        onMapClickListeners: function() {

        }
    };
    /**
     *
     * @param {Options} options настройки карты
     * @constructor
     */
    window.OpenMapRender = function MapRender(options) {

        options = Object.assign(defaultOptions, options);

        var map = generateMap(options.renderTo, options.defaultZoom, options.center);

        var pointFeatures = options.points.map(function(point) {
            return generatePoint(point);
        });

        if (options.cluster && options.cluster.enabled)
            setCluster(map, pointFeatures, options.cluster);
        else {
            setPoints(map, pointFeatures);
        }

        var lineFeatures = options.lines.map(function(line) {
            return generateLine(line.from, line.to, line.color, line.width);
        });

        setLines(map, lineFeatures);

        setClickListener(map, pointFeatures, options.onPointClickListeners, options.onMapClickListeners);

        return map;
    };


    function changeColorOpacityTo(color, opacity) {
        var newColor = ol.color.asArray(color);
        newColor = newColor.slice();
        newColor[3] = opacity;
        return newColor;
    }

    function setCluster(map, pointFeatures, cluster) {
        var clusterSource = new ol.source.Cluster({
            distance: cluster.distance,
            source: new ol.source.Vector({
                features: pointFeatures,
                cluster: cluster,
            })
        });

        var pointLayer = new ol.layer.Vector({
            source: clusterSource,
            style: function(feature) {
                var size = feature.get('features').length;
                // var color = feature.get('features')[0].pointSettings.color;
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: cluster.radius,
                        stroke: new ol.style.Stroke({
                            color: cluster.strokeColor,
                            width: cluster.strokeWidth
                        }),
                        fill: new ol.style.Fill({
                            color: cluster.color
                        })
                    }),
                    text: new ol.style.Text({
                        text: size.toString(),
                        fill: new ol.style.Stroke({
                            color: cluster.textColor
                        }),
                        font: cluster.font
                    })
                });
            }
        });

        map.addLayer(pointLayer);
    }

    function setPoints(map, pointFeatures) {
        var pointLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: pointFeatures,
            })
        });

        map.addLayer(pointLayer);
    }

    function setLines(map, lineFeatures) {
        var lineLayer = new ol.layer.Vector({
            source: new ol.source.Vector({
                features: lineFeatures
            })
        });

        map.addLayer(lineLayer);
    }

    function httpGetAsync(theUrl, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState === 4 && xmlHttp.status === 200)
                callback(xmlHttp.responseText);
        };
        xmlHttp.open("GET", theUrl, true);
        xmlHttp.setRequestHeader("Accept-Language", "ru-RU");
        xmlHttp.send(null);
    }

    function getAddress(lon, lat, callback) {
        var url = 'https://nominatim.openstreetmap.org/reverse?format=json&lon=' + lon + '&lat=' + lat;
        httpGetAsync(url, function(response) {
            callback(JSON.parse(response));
        })
    }

    function generateFullAddress(address) {
        var result = [];
        if (!address)
            return "";
        if (address.state)
            result.push(address.state);
        if (address.road)
            result.push(address.road);
        if (address.house_number)
            result.push(address.house_number);

        return result.join(", ");
    }

    var addressesCache = {};

    function showTooltip(map, feature, coordinates) {
        var pointSettings = feature.pointSettings;
        if (!pointSettings)
            return;
        var tooltip = pointSettings.tooltip;
        if (!tooltip || !tooltip.enabled)
            return;

        setTooltipText(map, tooltip.html, "загрузка...");
        map.getOverlayById("popup").setPosition(coordinates);

        if (tooltip.html.indexOf("@address") === -1)
            return;

        var coord = ol.proj.transform(coordinates, 'EPSG:3857', 'EPSG:4326');
        if (addressesCache[coord.join()])
            setTooltipText(map, tooltip.html, generateFullAddress(addressesCache[coord.join()].address));
        else
            getAddress(coord[0], coord[1], function(result) {
                if (!result) {
                    setTooltipText(map, tooltip.html, "загрузка...");
                    return;
                }
                addressesCache[coord.join()] = result;
                setTooltipText(map, tooltip.html, generateFullAddress(result.address));
            });
    }

    function getPopup(renderTo) {
        var container = document.getElementById(renderTo);
        return container.getElementsByClassName("va-map-popup")[0];
    }

    function getPopupContent(renderTo) {
        var container = document.getElementById(renderTo);
        return container.getElementsByClassName("va-map-popup-content")[0];
    }

    function getPopupCloser(renderTo) {
        var container = document.getElementById(renderTo);
        return container.getElementsByClassName("va-map-popup-closer")[0];
    }

    function setTooltipText(map, text, addressText) {
        var content = getPopupContent(map.getTarget());
        content.innerHTML = text.replace("@address", addressText);
    }

    function zoomToPoint(map, coordinates) {
        map.getView().animate({
            center: coordinates,
            zoom: map.getView().getZoom() + 2,
            duration: 500
        });
    }

    function getTransformScale(element) {
        try {
            var matrix = window.getComputedStyle(element).transform.match(/-?[\d\.]+/g); // массив данных transform
            if (Array.isArray(matrix))
                return matrix[0];
        } catch (e) {
        }
        return 1;
    }

    function applyScaleForClickEvent(event) {
        var scales = event.originalEvent.path.map(function(el) {
            return getTransformScale(el);
        });
        var minScale = Math.min.apply(null, scales);
        event.pixel[0] = event.pixel[0] / minScale;
        event.pixel[1] = event.pixel[1] / minScale;
    }

    function setClickListener(map, pointFeatures, onPointClickListeners, onMapClickListeners) {

        map.on('click', function(event) {

            // хак: дэшборд находится в scale (fit=true), поэтому неправильно определяется местоположение мышки
            applyScaleForClickEvent(event);

            var feature = map.forEachFeatureAtPixel(event.pixel, function(feature) {
                return feature;
            });

            if (!feature) {
                getPopupCloser(map.getTarget()).click();
                return;
            }

            var featureIsCluster = feature.values_.features !== undefined;

            // Если это кластеризация, то работать начинает с тултипами
            if (featureIsCluster) {
                var coordinates = feature.getGeometry().getCoordinates();
                if (feature.values_.features.length > 1) {
                    zoomToPoint(map, coordinates);
                } else {
                    showTooltip(map, feature.values_.features[0], coordinates);
                }

                return;
            }

            // Если нет кластеризации, то работает выделение точек
            if (feature && feature.pointSettings) {
                feature.isSelected = !feature.isSelected;

                feature.setStyle(feature.originalStyle);
                var image = feature.getStyle().getImage();
                image.setOpacity(1);

                pointFeatures.forEach(function(f) {
                    if (feature === f)
                        return;

                    f.isSelected = false;
                    var image = f.getStyle().getImage();
                    image.setOpacity(feature.isSelected ? 0.5 : 1.0);
                });

                onPointClickListeners(feature.pointSettings);

            } else {
                pointFeatures.forEach(function(f) {
                    f.setStyle(f.originalStyle);
                    f.isSelected = false;
                    var image = f.getStyle().getImage();
                    image.setOpacity(1.0);
                });

                onMapClickListeners();
            }
        });

        map.on('pointermove', function(event){
            // хак: дэшборд находится в scale (fit=true), поэтому неправильно определяется местоположение мышки
            applyScaleForClickEvent(event);
            var hit = map.hasFeatureAtPixel(event.pixel);
            map.getViewport().style.cursor = hit ? 'pointer' : '';
        });
    }

    function generateMap(renderTo, zoom, centerCoordinates) {

        document.getElementById(renderTo).innerHTML = '<div class="ol-popup va-map-popup">' +
            '<a href="#" class="ol-popup-closer va-map-popup-closer"></a>' +
            '<div class="va-map-popup-content"></div>' +
            '</div>';

        var popupOverlay = new ol.Overlay({
            id: "popup",
            element: getPopup(renderTo),
            autoPan: true,
            autoPanAnimation: {
                duration: 250
            }
        });

        var map = new ol.Map({
            target: renderTo,
            layers: [
                new ol.layer.Tile({
                    source: new ol.source.OSM(
                        {
                            crossOrigin: 'anonymous'
                        }
                    )
                })
            ],
            overlays: [popupOverlay],
            view: new ol.View({
                center: ol.proj.fromLonLat([centerCoordinates.longitude, centerCoordinates.latitude]),
                zoom: zoom
            })
        });


        var closer = getPopupCloser(renderTo);
        if (closer) {
            closer.onclick = function() {
                popupOverlay.setPosition(undefined);
                closer.blur();
                return false;
            };
        }

        return map;
    }

    /**
     * Генерация точки
     * @param pointSettings
     * @returns {ov.http://www.opengis.net/wfs.Feature|Feature|pd}
     */
    function generatePoint(pointSettings) {
        var style = new ol.style.Style({
            image: new ol.style.Circle({
                radius: pointSettings.radius,
                fill: new ol.style.Fill({
                    color: pointSettings.color
                }),
                stroke: new ol.style.Stroke({
                    width: pointSettings.strokeWidth,
                    color: changeColorOpacityTo(pointSettings.color, 1),
                })
            }),
        });

        var pointFeature = new ol.Feature({
            geometry: new ol.geom.Point(ol.proj.fromLonLat([pointSettings.longitude, pointSettings.latitude])),
        });

        pointFeature.setStyle(style);
        pointFeature.originalStyle = style;
        pointFeature.pointSettings = pointSettings;

        if (pointSettings.isSelected === false)
            style.getImage().setOpacity(pointSettings.isSelected === false ? 0.5 : 1.0);

        return pointFeature;
    }

    /**
     *
     * @param {Coordinate} from откуда нужно построить линию
     * @param {Coordinate} to докуда нужно построить линию
     * @param {string} lineColor цвет линии
     * @param {number} lineWidth толщина линии
     * @returns {ov.http://www.opengis.net/wfs.Feature|Feature|pd}
     */
    function generateLine(from, to, lineColor, lineWidth) {

        var style = new ol.style.Style({
            fill: new ol.style.Fill({ color: lineColor, weight: 1 }),
            stroke: new ol.style.Stroke({ color: lineColor, width: lineWidth })
        });

        var arcGenerator = new arc.GreatCircle(
            { x: from.longitude, y: from.latitude },
            { x: to.longitude, y: to.latitude });
        var arcLine = arcGenerator.Arc(100, { offset: 10 });
        var points = arcLine.geometries[0].coords;

        for (var i = 0; i < points.length; i++) {
            points[i] = ol.proj.transform(points[i], 'EPSG:4326', 'EPSG:3857');
        }

        var lineFeature = new ol.Feature({
            geometry: new ol.geom.LineString(points),
            finished: false
        });

        lineFeature.setStyle([style]);

        return lineFeature;
    }

})();

