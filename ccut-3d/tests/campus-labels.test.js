const test = require('node:test');
const assert = require('node:assert/strict');

const { applyEastCampusLabels } = require('../campus-labels.js');

test('east-campus buildings follow the supplied 2026 plan without moving geometry', () => {
  const buildings = [
    { id: 1420146254, name: '1栋', pts: [[1, 2]] },
    { id: 1420146256, name: '2栋', pts: [[3, 4]] },
    { id: 1420146257, name: '3栋', pts: [[5, 6]] },
    { id: 1420146259, name: '4栋', pts: [[7, 8]] },
    { id: 1420146267, name: '5栋', pts: [[9, 10]] },
    { id: 1420146269, name: '6栋', pts: [[11, 12]] },
    { id: 1420146271, name: '7栋', pts: [[13, 14]] },
    { id: 1420146272, name: '后勤及附属用房', pts: [[15, 16]] },
    { id: 1420146280, name: '主教学楼', pts: [[17, 18]] },
  ];
  const data = { buildings, places: [] };

  applyEastCampusLabels(data);

  assert.deepEqual(buildings.map((building) => building.name), [
    '2栋男寝', '1栋男寝', '4栋女寝', '3栋男寝',
    '6栋女寝', '5栋女寝', '7栋女寝', '8栋女寝', '东区教学主楼',
  ]);
  assert.deepEqual(buildings.map((building) => building.pts), [
    [[1, 2]], [[3, 4]], [[5, 6]], [[7, 8]], [[9, 10]],
    [[11, 12]], [[13, 14]], [[15, 16]], [[17, 18]],
  ]);
});

test('official college labels replace obsolete labels and unnamed research apartments are not invented', () => {
  const data = {
    buildings: [
      { id: 1420146255, name: '知信苑' },
      { id: 1420146258, name: '雅馨苑' },
      { id: 1420146268, name: '雅慧苑' },
      { id: 1420146277, name: '大学生活动中心' },
      { id: 1420146278, name: '艺术技术楼' },
      { id: 1420146279, name: '信息传播楼' },
      { id: 1420146282, name: '东区食堂' },
      { id: 1420146291, name: '换热站' },
      { id: 1420146292, name: '变电站' },
      { id: 933, name: '体育馆' },
      { id: 936, name: '' },
      { id: 937, name: '' },
      { id: 940, name: '门卫室' },
    ],
    places: [
      { key: '2', name: '主教学楼广场' },
      { key: '5', name: '艺术技术楼' },
      { key: '6', name: '信息传播楼' },
    ],
  };

  applyEastCampusLabels(data);

  assert.deepEqual(data.buildings.map((building) => building.name), [
    '', '', '', '体育馆·大学生活动中心', '艺术设计学院',
    '新闻传播学院', '食堂', '', '', '',
    '马克思主义学院·数学与统计学院', '', '',
  ]);
  assert.deepEqual(data.places.map((place) => place.name), [
    '东区教学主楼广场', '艺术设计学院', '新闻传播学院',
  ]);
  assert.equal(data.buildings.some((building) => building.name === '研究生公寓'), false);
});
