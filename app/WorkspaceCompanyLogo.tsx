import Image from "next/image";

/**
 * Утверждённый горизонтальный логотип ПАНДА:
 * красная панда и график слева, рыжая надпись ПАНДА справа.
 * Изображение прозрачное. Никаких дополнительных подписей.
 */
export default function WorkspaceCompanyLogo() {
  return (
    <Image
      className="home-company-logo-image"
      src="/panda/panda-workspace-brand.webp"
      alt="ПАНДА"
      width={194}
      height={65}
      priority
      unoptimized
    />
  );
}
