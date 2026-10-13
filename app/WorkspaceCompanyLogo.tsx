export default function WorkspaceCompanyLogo() {

  return (

    <svg
      viewBox="0 0 200 54"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className=
        "home-company-logo-image home-company-logo-svg"
    >

      {/* ==========================================
          ИП БАБУШКИНА
          ========================================== */}

      <text
        x="0"
        y="23"
        textLength="191"
        lengthAdjust="spacingAndGlyphs"
        className=
          "home-company-logo-main"
        fontFamily=
          "Arial, Helvetica, sans-serif"
        fontSize="22"
        fontWeight="900"
      >
        ИП Бабушкина
      </text>


      {/* ==========================================
          МАРКЕТПЛЕЙСЫ
          ========================================== */}

      <text
        x="0"
        y="40"
        textLength="119"
        lengthAdjust="spacingAndGlyphs"
        className=
          "home-company-logo-marketplace"
        fontFamily=
          "Arial, Helvetica, sans-serif"
        fontSize="13.5"
        fontWeight="900"
      >
        Маркетплейсы
      </text>


      {/* ==========================================
          ЖЁЛТАЯ ЛИНИЯ
          ========================================== */}

      <rect
        x="0"
        y="45"
        width="121"
        height="4"
        rx="2"
        className=
          "home-company-logo-underline"
      />

    </svg>

  );

}
