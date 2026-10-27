"""Build local drill-down geometry from the same public source/projection as map-data.js.
Only writes dist/map-levels.js. Public child source requests are reads; no upload occurs.
Run with the bundled Python runtime; network is needed only while rebuilding this file.
"""
from __future__ import annotations

import hashlib
import json
import math
import re
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROVINCE_SOURCE = ROOT / "qa" / "hainan-source.json"
PROVINCE_MAP = ROOT / "dist" / "map-data.js"
OUTPUT = ROOT / "dist" / "map-levels.js"
BASE_URL = "https://geo.datav.aliyun.com/areas_v3/bound/"
RETRIEVED_AT = "2026-10-25"
REQUESTS = ["460100", "460200", "460400", "469002"]
WIDTH, HEIGHT = 900, 540
ISLAND_MIN_LON, ISLAND_MAX_LON = 108.591082, 111.071327
ISLAND_MIN_LAT, ISLAND_MAX_LAT = 18.143554, 20.16353
SCALE_Y = 450 / (ISLAND_MAX_LAT - ISLAND_MIN_LAT)
SCALE_X = SCALE_Y * 0.945
CENTER_LON = (ISLAND_MIN_LON + ISLAND_MAX_LON) / 2


def project(point):
    lon, lat = point[:2]
    if not all(isinstance(v, (float, int)) and math.isfinite(v) for v in [lon, lat]):
        raise ValueError("A geometry coordinate is invalid")
    return [round(450 + (lon - CENTER_LON) * SCALE_X, 2),
            round(33 + (ISLAND_MAX_LAT - lat) * SCALE_Y, 2)]


def rings(feature):
    geometry = feature["geometry"]
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        polygons = [coordinates]
    elif geometry["type"] == "MultiPolygon":
        polygons = coordinates
    else:
        raise ValueError("Unsupported geometry type: " + str(geometry["type"]))
    result = []
    for polygon in polygons:
        for ring in polygon:
            if len(ring) < 4 or ring[0][:2] != ring[-1][:2]:
                raise ValueError("Geometry contains an invalid or unclosed ring")
            result.append([project(point) for point in ring])
    if not result:
        raise ValueError("Geometry is empty")
    return result


def make_path(projected_rings):
    return " ".join("M" + " L".join(str(x) + "," + str(y) for x, y in ring) + " Z"
                    for ring in projected_rings)


def path_points(path):
    return [[float(x), float(y)] for x, y in re.findall(r"[ML]([-.0-9]+),([-.0-9]+)", path)]


def point_bounds(points):
    min_x = min(p[0] for p in points)
    max_x = max(p[0] for p in points)
    min_y = min(p[1] for p in points)
    max_y = max(p[1] for p in points)
    return [round(min_x, 2), round(min_y, 2), round(max_x - min_x, 2), round(max_y - min_y, 2)]


def union_bounds(bounds):
    return point_bounds([[b[0], b[1]] for b in bounds] +
                        [[b[0] + b[2], b[1] + b[3]] for b in bounds])


def read_map():
    text = PROVINCE_MAP.read_text(encoding="utf-8-sig")
    return json.loads(text.split("globalThis.HainanMapData=", 1)[1].strip().removesuffix(";"))


def fetch_children(code):
    url = BASE_URL + code + "_full.json"
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            body = response.read()
            http_status = response.status
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None, {"code": code, "url": url, "httpStatus": 404,
                          "status": "not-provided", "featureCount": 0}
        raise
    data = json.loads(body)
    if data.get("type") != "FeatureCollection" or not isinstance(data.get("features"), list):
        raise ValueError("Invalid FeatureCollection at " + url)
    codes = set()
    for feature in data["features"]:
        props = feature["properties"]
        child = str(props["adcode"])
        if child in codes or child == code or str(props.get("parent", {}).get("adcode")) != code:
            raise ValueError("Unexpected child identity at " + url)
        if props.get("level") != "district":
            raise ValueError("Unexpected child level at " + url)
        rings(feature)
        codes.add(child)
    return data, {"code": code, "url": url, "httpStatus": http_status,
                  "status": "available" if codes else "not-provided",
                  "featureCount": len(codes), "bytes": len(body),
                  "sha256": hashlib.sha256(body).hexdigest()}


def build():
    province_bytes = PROVINCE_SOURCE.read_bytes()
    province = json.loads(province_bytes.decode("utf-8-sig"))
    original = read_map()
    source_features = {str(f["properties"]["adcode"]): f for f in province["features"]}
    nodes = {}
    point_count = 0
    for region in original["regions"]:
        code = str(region["code"])
        feature = source_features[code]
        generated_points = [p for ring in rings(feature) for p in ring]
        existing_points = path_points(region["path"])
        if generated_points != existing_points:
            raise ValueError("Province projection differs from map-data.js at " + code)
        if project(feature["properties"]["center"]) != region["center"]:
            raise ValueError("Province center differs from map-data.js at " + code)
        point_count += len(existing_points)
        nodes[code] = {
            "code": code, "name": region["name"], "parent": "460000",
            "level": "city", "path": region["path"],
            "bounds": point_bounds(existing_points), "center": region["center"],
            "children": [], "childStatus": "not-provided",
            "source": BASE_URL + "460000_full.json",
        }
    statuses = []
    for code in REQUESTS:
        if code not in nodes:
            raise ValueError("Requested city does not exist in the province map")
        data, status = fetch_children(code)
        statuses.append(status)
        nodes[code]["childSource"] = status["url"]
        nodes[code]["childStatus"] = status["status"]
        if data is None:
            continue
        for feature in data["features"]:
            props = feature["properties"]
            child = str(props["adcode"])
            if child in nodes:
                raise ValueError("Duplicate node ID: " + child)
            projected_rings = rings(feature)
            points = [p for ring in projected_rings for p in ring]
            center_key = "centroid" if props.get("centroid") else "center"
            center = project(props[center_key]) if props.get(center_key) else [
                round((min(p[0] for p in points) + max(p[0] for p in points)) / 2, 2),
                round((min(p[1] for p in points) + max(p[1] for p in points)) / 2, 2),
            ]
            nodes[child] = {
                "code": child, "name": props["name"], "parent": code,
                "level": "district", "path": make_path(projected_rings),
                "bounds": point_bounds(points), "center": center,
                "children": [], "childStatus": "not-provided",
                "source": status["url"], "centerSource": center_key,
            }
            nodes[code]["children"].append(child)
        # Fine-resolution child coastlines may extend just outside the simplified province path.
        nodes[code]["bounds"] = union_bounds(
            [nodes[code]["bounds"]] + [nodes[c]["bounds"] for c in nodes[code]["children"]])
    cities = [str(region["code"]) for region in original["regions"]]
    root_node = {
        "code": "460000", "name": "海南省", "parent": None, "level": "province",
        "path": "", "bounds": [0, 0, WIDTH, HEIGHT],
        "center": [450, 270], "children": cities, "childStatus": "available",
        "source": BASE_URL + "460000_full.json",
    }
    nodes = {"460000": root_node, **nodes}
    for key, node in nodes.items():
        if key != node["code"] or not isinstance(key, str):
            raise ValueError("Node keys must be string administrative codes")
        if not all(math.isfinite(v) for v in node["bounds"]) or min(node["bounds"][2:]) <= 0:
            raise ValueError("Invalid bounds for " + key)
        for child in node["children"]:
            if nodes[child]["parent"] != key:
                raise ValueError("Invalid parent-child relation")
    output = {
        "version": 1, "root": "460000", "viewBox": [0, 0, WIDTH, HEIGHT],
        "nodes": nodes,
        "source": {
            "provider": "Alibaba Cloud DataV", "retrievedAt": RETRIEVED_AT,
            "province": BASE_URL + "460000_full.json",
            "provinceSha256": hashlib.sha256(province_bytes).hexdigest(),
            "childSources": statuses,
            "projection": {
                "type": "same-linear-display-projection-as-map-data.js",
                "centerLongitude": CENTER_LON, "northLatitude": ISLAND_MAX_LAT,
                "scaleX": SCALE_X, "scaleY": SCALE_Y, "offsetX": 450, "offsetY": 33,
                "precisionDecimals": 2, "verifiedProvincePoints": point_count,
            },
            "notes": [
                "Display geometry only; not a surveyed or authoritative current administrative map.",
                "No runtime network requests. Province paths are copied unchanged from map-data.js.",
                "children=[] means this local public source did not provide a lower-level boundary.",
                "Only Haikou and Sanya have child districts in the four requested public endpoints.",
                "Sansha remains in the existing separately projected inset and is not a drill-down node.",
                "No device locations, district assignments, or township boundaries are inferred.",
            ],
        },
    }
    OUTPUT.write_text(
        "/* Local drill-down geometry; generated by qa/build-map-levels.py. See MAP-SOURCE.md. */\n"
        + "globalThis.MapLevels=" + json.dumps(output, ensure_ascii=False, separators=(",", ":"))
        + ";\n", encoding="utf-8")
    print(json.dumps({"output": str(OUTPUT), "nodes": len(nodes),
                      "cities": len(cities), "districts": sum(n["level"] == "district" for n in nodes.values()),
                      "verifiedProvincePoints": point_count, "sources": statuses},
                     ensure_ascii=False))


if __name__ == "__main__":
    build()

