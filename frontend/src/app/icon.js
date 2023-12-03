import { getGlobal } from "@/utils/strapi";
import { ImageResponse } from "next/server";

export const runtime = "edge";

export const size = {
  width: 32,
  height: 32,
};
export const contentType = "image/png";

export default async function Icon() {
  const global = await getGlobal();

  return new ImageResponse(
    (
      <img
        src={global.favicon?.data?.attributes.url}
        className="h-full w-full"
      />
    ),
    {
      ...size,
    },
  );
}
