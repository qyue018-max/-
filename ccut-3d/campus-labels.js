(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else {
    root.CAMPUS_LABELS = api;
    if (root.CAMPUS_DATA) api.applyEastCampusLabels(root.CAMPUS_DATA);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const BUILDING_NAMES = Object.freeze({
    1420146254: '2栋男寝',
    1420146255: '',
    1420146256: '1栋男寝',
    1420146257: '4栋女寝',
    1420146258: '',
    1420146259: '3栋男寝',
    1420146267: '6栋女寝',
    1420146268: '',
    1420146269: '5栋女寝',
    1420146271: '7栋女寝',
    1420146272: '8栋女寝',
    1420146277: '体育馆·大学生活动中心',
    1420146278: '艺术设计学院',
    1420146279: '新闻传播学院',
    1420146280: '东区教学主楼',
    1420146282: '食堂',
    1420146291: '',
    1420146292: '',
    933: '',
    936: '马克思主义学院·数学与统计学院',
    940: '',
  });

  const PLACE_NAMES = Object.freeze({
    2: '东区教学主楼广场',
    3: '东区学生宿舍区',
    5: '艺术设计学院',
    6: '新闻传播学院',
  });

  function applyEastCampusLabels(data) {
    if (!data) return data;
    for (const building of data.buildings || []) {
      if (Object.prototype.hasOwnProperty.call(BUILDING_NAMES, building.id)) {
        building.name = BUILDING_NAMES[building.id];
      }
    }
    for (const place of data.places || []) {
      if (Object.prototype.hasOwnProperty.call(PLACE_NAMES, place.key)) {
        place.name = PLACE_NAMES[place.key];
      }
    }
    return data;
  }

  return { applyEastCampusLabels };
});
