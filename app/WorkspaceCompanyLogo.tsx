import Image from "next/image";

/**
 * Утверждённый горизонтальный логотип ПАНДА.
 * Маскот и график сохраняют прежний размер 194x65 исходного изображения:
 * левую часть просто показываем через окно шириной 73px.
 * Надпись является отдельным прозрачным изображением исходного шрифта,
 * уменьшенным на ~10%, без серой тени.
 */
export default function WorkspaceCompanyLogo() {
  return (
    <span className="workspace-panda-horizontal" aria-hidden="true">
      <span className="workspace-panda-illustration-window">
        <Image
          className="workspace-panda-illustration-original"
          src="/panda/panda-workspace-brand.webp"
          alt=""
          width={194}
          height={65}
          priority
          unoptimized
        />
      </span>
      <Image
        className="workspace-panda-clean-wordmark"
        src="/panda/panda-workspace-wordmark-clean.webp"
        alt=""
        width={108}
        height={26}
        priority
        unoptimized
      />
    </span>
  );
}
