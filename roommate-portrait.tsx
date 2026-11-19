import Image from "next/image";
import portrait from "../../public/511-roommates.png";

type RoommatePortraitProps = { variant: "welcome" | "auth" };

const portraitSizes = {
  welcome: "(max-width: 490px) calc(100vw - 66px), (max-width: 680px) 426px, (max-width: 1120px) 40vw, 550px",
  auth: "(max-width: 450px) calc(100vw - 134px), 316px",
};

export function RoommatePortrait({ variant }: RoommatePortraitProps) {
  return (
    <Image
      className="roommate-portrait"
      src={portrait}
      alt="511 宿舍四位成员的手绘形象"
      sizes={portraitSizes[variant]}
      loading="eager"
    />
  );
}
