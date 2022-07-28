import React, { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxGeocoder from "@mapbox/mapbox-gl-geocoder";
import * as turf from "@turf/turf";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "./Map.css";
import { MapboxLayer } from "@deck.gl/mapbox";
import { ArcLayer } from "@deck.gl/layers";
import { ScatterplotLayer } from "deck.gl";

mapboxgl.accessToken =
  "pk.eyJ1IjoiaW5heWF0MTIzIiwiYSI6ImNsNXVtN3NpbDAxOGIzY21wdWg1YWlzaWcifQ.n9fRYAkmbJW6kUzVF4vC9A";

const Map = () => {
  const mapContainerRef = useRef(null);
  const [result, setResult] = useState([]);

  const [lng, setLng] = useState(5);
  const [lat, setLat] = useState(34);
  const [zoom, setZoom] = useState(1.5);

  // Initialize map when component mounts
  useEffect(() => {
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v11",
      center: [-122.402, 37.79],
      zoom: 14.51,
      pitch: 50,
    });
    const coordinatesGeocoder = function (query) {
      // Match the place which we search
      const matches = query.match(
        /^[ ]*(?:Lat: )?(-?\d+\.?\d*)[, ]+(?:Lng: )?(-?\d+\.?\d*)[ ]*$/i
      );
      if (!matches) {
        return null;
      }

      function coordinateFeature(lng, lat) {
        return {
          center: [lng, lat],
          geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          place_name: "Lat: " + lat + " Lng: " + lng,
          place_type: ["coordinate"],
          properties: {},
          type: "Feature",
        };
      }

      const coord1 = Number(matches[1]);
      const coord2 = Number(matches[2]);
      const geocodes = [];

      if (coord1 < -90 || coord1 > 90) {
        // must be lng, lat
        geocodes.push(coordinateFeature(coord1, coord2));
      }

      if (coord2 < -90 || coord2 > 90) {
        // must be lat, lng
        geocodes.push(coordinateFeature(coord2, coord1));
      }

      if (geocodes.length === 0) {
        // else could be either lng, lat or lat, lng
        geocodes.push(coordinateFeature(coord1, coord2));
        geocodes.push(coordinateFeature(coord2, coord1));
      }

      return geocodes;
    };

    map.on("load", () => {
      const firstLabelLayerId = map
        .getStyle()
        .layers.find((layer) => layer.type === "symbol").id;

      map.addLayer(
        {
          id: "2d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",

            // use an 'interpolate' expression to add a smooth transition effect to the
            // buildings as the user zooms in
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.6,
          },
        },
        firstLabelLayerId
      );

      map.addLayer(
        new MapboxLayer({
          id: "deckgl-circle",
          type: ScatterplotLayer,
          data: [
            { position: [-122.402, 37.79], color: [255, 0, 0], radius: 1000 },
          ],
          getPosition: (d) => d.position,
          getFillColor: (d) => d.color,
          getRadius: (d) => d.radius,
          opacity: 0.3,
        }),
        firstLabelLayerId
      );

      map.addLayer(
        new MapboxLayer({
          id: "deckgl-arc",
          type: ArcLayer,
          data: [
            {
              source: [-122.3998664, 37.7883697],
              target: [-122.400068, 37.7900503],
            },
          ],
          getSourcePosition: (d) => d.source,
          getTargetPosition: (d) => d.target,
          getSourceColor: [255, 208, 0],
          getTargetColor: [0, 128, 255],
          getWidth: 8,
        })
      );
    });
    // Add navigation control (the +/- zoom buttons)
    map.addControl(
      new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        localGeocoder: coordinatesGeocoder,
        zoom: 4,
        placeholder: "Search Place",
        mapboxgl: mapboxgl,
        reverseGeocode: true,
      })
    );
    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("move", () => {
      setLng(map.getCenter().lng.toFixed(4));
      setLat(map.getCenter().lat.toFixed(4));
      setZoom(map.getZoom().toFixed(2));
    });
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      // Select which mapbox-gl-draw control buttons to add to the map.
      controls: {
        polygon: true,
        trash: true,
      },
      // Set mapbox-gl-draw to draw by default.
      // The user does not have to click the polygon control button first.
      defaultMode: "draw_polygon",
    });
    map.addControl(draw);

    map.on("draw.create", updateArea);
    map.on("draw.delete", updateArea);
    map.on("draw.update", updateArea);

    function updateArea(e) {
      //data is geojson data containing object of FeatureCollection and array of coordinates
      const data = draw.getAll();
      const answer = document.getElementById("calculated-area");
      if (data.features.length > 0) {
        const area = turf.area(data);
        // Restrict the area to 2 decimal points.
        const rounded_area = Math.round(area * 100) / 100;
        answer.innerHTML = `<p>Area is <strong>${rounded_area}</strong> Square meters</p>`;
      } else {
        answer.innerHTML = "";
        if (e.type !== "draw.delete") alert("Click the map to draw a polygon.");
      }

      window.localStorage.setItem("data", JSON.stringify(data));
      const items = JSON.parse(localStorage.getItem("data"));

      if (items) {
        setResult(items);
      }
    }

    // Clean up on unmount
    return () => map.remove();
  }, []);

  return (
    <div style={{ display: "flex" }}>
      <div className="map-container" ref={mapContainerRef} />

      <div className="sidebarStyle">
        <div>
          <div className="calculation-box">
            <p>Click the map to draw a polygon.</p>
            <div id="calculated-area"></div>
          </div>
          {/* <p>Longitude: {lng}</p>
          <p>Latitude: {lat}</p> */}
          <p>zoom: {zoom}</p>
        </div>

        {localStorage.getItem("data") && (
          <div>
            <div>
              {JSON.parse(window.localStorage.getItem("data")).features.map(
                (item) =>
                  item.geometry.coordinates.map((cord, index) => (
                    <div>
                      {" "}
                      Saved coordinates of shape
                      {cord.map((i, index) => (
                        <div key={index}>
                          <ul>
                            <li>{`${i[0]} , ${i[1]}`} </li>
                            <br />
                          </ul>
                        </div>
                      ))}
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Map;
