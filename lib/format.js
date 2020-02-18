// eslint-disable-next-line no-extra-semi
;(function() {
  "use strict";
  const root            = this;
  const previous_format = root.format;

  const METERS_PER_FOOT = 0.3048;

  const format = Object.create(null, {
    FEET    : { get: function() { return _forward(METERS_PER_FOOT); }, enumerable: true },
    FT      : { get: function() { return _forward(METERS_PER_FOOT); }, enumerable: true },
    F       : { get: function() { return _forward(METERS_PER_FOOT); }, enumerable: true },
    METERS  : { get: function() { return _forward(1); }, enumerable: true },
    M       : { get: function() { return _forward(1); }, enumerable: true },
    KM      : { get: function() { return _forward(1e3); }, enumerable: true },
    CM      : { get: function() { return _forward(1e-2); }, enumerable: true },
    MM      : { get: function() { return _forward(1e-3); }, enumerable: true }
  });

  function _forward(base) {
    return Object.create(null, {
      to    : { get: function() { return _fmtFrom(base); } },
      as    : { get: function() { return _fmtFrom(base); } }
    });
  }
  function _fmtFrom(base) {
    return Object.assign(
      Object.create(null, {
        FEET  : { get : function() { return _fmtToFT(base); } },
        FT    : { get : function() { return _fmtToFT(base); } },
        F     : { get : function() { return _fmtToFT(base); } }
      }),
      {
        M      : function(digits, sfx=' m') { return _fmtToSI(base, 'm', digits, sfx); },
        METERS : function(digits, sfx=' m') { return _fmtToSI(base, 'm', digits, sfx); },
        KM     : function(digits, sfx=' km') { return _fmtToSI(base, 'km', digits, sfx); },
        CM     : function(digits, sfx=' cm') { return _fmtToSI(base, 'cm', digits, sfx); },
      }
    );
  }
  function _fmtToFT(base) {
    return Object.assign(
      Object.create(null, {
        IN    : { get : function() { return _fmtToFT_IN(base); } },
        INCHES: { get : function() { return _fmtToFT_IN(base); } }
      }),
      {
        DEC     : function(digits, sfx=' ft') { return _fmtToFT_DEC(base, digits, sfx); },
        DECIMAL : function(digits, sfx=' ft') { return _fmtToFT_DEC(base, digits, sfx); }
      }
    );
  }
  function _sfxFTIN(sfx) {
    if (Array.isArray(sfx) && sfx.length == 2) {
      return sfx;
    }
    return ["' ", '"'];
  }
  function _fmtToFT_IN(base) {
    return {
      DEC       : function(digits, sfx=_sfxFTIN()) { return _fmtToFT_IN_DEC(base, digits, sfx); },
      DECIMAL   : function(digits, sfx=_sfxFTIN()) { return _fmtToFT_IN_DEC(base, digits, sfx); },
      FRAC      : function(denom, sfx=_sfxFTIN()) { return _fmtToFT_IN_FRAC(base, denom, sfx); },
      FRACTIONAL: function(denom, sfx=_sfxFTIN()) { return _fmtToFT_IN_FRAC(base, denom, sfx); }
    };
  }
  function _fmtToFT_DEC(base, digits, sfx) {
    return _saneInput(function (valueIn) {
      const val =  valueIn * (base / METERS_PER_FOOT);
      return 1*val.toFixed(digits) + sfx;
    });
  }
  function _fmtToFT_IN_DEC(base, digits, sfx) {
    sfx = _sfxFTIN(sfx);
    return _saneInput(function (valueIn) {
      const val =  valueIn * (base / METERS_PER_FOOT);
      let feet = Math.trunc(val);
      let inches = Math.abs((12 * (val - feet)).toFixed(digits));
      if (inches === 12) {
        inches = 0;
        feet += Math.sign(val);
      }
      // return feet > 0 ? feet + sfx[0] + Math.abs(inches.toFixed(digits)) + sfx[1] : Math.abs(inches.toFixed(digits)) + sfx[1];
      return feet + sfx[0] + Math.abs(inches.toFixed(digits)) + sfx[1]; // Fix for negative values - don't just ignore the sign...
    });
  }
  function _fmtToFT_IN_FRAC(base, denom, sfx) {
    sfx = _sfxFTIN(sfx);
    if (!denom || !isFinite(denom) || denom < 1) {
      denom = 16;
    }
    const denomConst = denom;

    return _saneInput(function (valueIn) {
      let denom = denomConst;   // Because "denom" will change during fraction simplification!
      const val =  valueIn * (base / METERS_PER_FOOT);
      let feet = Math.trunc(val);
      const inches = 12 * (val - feet);
      let wholeInches = Math.trunc(inches);
      let numerator = Math.round(denom * (inches - wholeInches));

      if (Math.abs(numerator) === denom) {  // "within epsilon", e.g. 7.999999999, -5.499999999
        wholeInches += Math.sign(valueIn);
        numerator = 0;
        if (Math.abs(wholeInches) === 12) {
          feet += Math.sign(valueIn);
          wholeInches = 0;
        }
      }
      const sgn = ((feet === 0 && valueIn < 0) || feet < 0 ? '-' : '');
      if (numerator === 0) {
        // We potentially end up with two signs ("--") here, remove one
        return (sgn + feet + sfx[0] + Math.abs(wholeInches) + sfx[1]).replace(/(.)\1+/g, '$1')
      }
      while (numerator % 2 === 0 && denom % 2 === 0) {
        numerator /= 2;
        denom /= 2;
      }
      // We potentially end up with two signs ("--") here, remove one
      return (sgn + feet + sfx[0] + Math.abs(wholeInches) + ' ' + Math.abs(numerator) + '/' + denom + sfx[1]).replace(/(.)\1+/g, '$1');
    });
  }

  const _siUnits = {
    pm : 1e-12,
    nm : 1e-9,
    um : 1e-6,
    mm : 1e-3,
    cm : 1e-2,
    m  : 1,
    km : 1e+3,
  };
  function _fmtToSI(base, units, digits, sfx) {
    const unitSz = _siUnits[units];
    if (unitSz === undefined) {
      // This cannot be triggered by the user. Only future bugs could lead us here.
      throw new Error('Unsupported SI length unit');
    }
    return _saneInput(function (valueIn) {
      const val = valueIn * (base / unitSz);
      return 1*val.toFixed(digits) + sfx;
    });
  }

  // Filter the input value - make sure it is a number
  function _saneInput(func) {
    return function (valueIn) {
      if (!Number.isFinite(valueIn)) {
        throw new Error('Value to format is not a number');
      }
      return func(valueIn);
    };
  }

  // ------------------- EXPORTS ----------------------
  const toExport = format;

  // --- Node.js and Browser support shebang ---
  toExport.noConflict = function() {
    root.format = previous_format;
    return toExport;
  };
  if( typeof exports !== 'undefined' ) {
    if( typeof module !== 'undefined' && module.exports ) {
      exports = module.exports = toExport;
    }
    exports.format = toExport;
  }
  else {
    root.format = toExport;
  }
}).call(this);
