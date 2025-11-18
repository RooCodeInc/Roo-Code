/**
 * Test fixture: Minified JavaScript code
 * Tests handling of minified/obfuscated code
 */
!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e="undefined"!=typeof globalThis?globalThis:e||self).MyLibrary=t()}(this,(function(){"use strict";function e(e,t){return e+t}function t(e,t){return e*t}function n(e){return e.map((e=>e*2))}function r(e){return e.filter((e=>e%2==0))}function o(e,t){return e.reduce(((e,n)=>e+n),t)}class i{constructor(e){this.value=e}getValue(){return this.value}setValue(e){this.value=e}map(e){return new i(e(this.value))}}const a={add:e,multiply:t,double:n,filterEven:r,sum:o,Box:i};return a}));

