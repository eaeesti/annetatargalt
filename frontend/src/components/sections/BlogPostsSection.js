import Anchor from "../elements/Anchor";
import Image from "../elements/Image";
import { getBlogPosts } from "@/utils/strapi";

export default async function BlogPostsSection({ global, page }) {
  const blogPosts = await getBlogPosts();

  return (
    <div className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-0 sm:px-4 lg:px-8">
        <div className="mx-auto grid max-w-2xl grid-cols-1 gap-x-2 gap-y-12 md:mx-0 md:max-w-none md:grid-cols-2 lg:grid-cols-3">
          {blogPosts.map((post) => (
            <Anchor key={post.id} href={`/${page.slug}/${post.slug}`}>
              <article
                key={post.id}
                className="group flex flex-col items-start gap-6 p-6 hover:cursor-pointer hover:bg-slate-100 sm:rounded-3xl"
              >
                <div className="relative w-full">
                  <Image
                    data={post.image}
                    className="aspect-[2/1] w-full rounded-2xl bg-slate-200 object-cover md:aspect-[3/2]"
                  />
                  <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-slate-900/10" />
                </div>
                <time dateTime={post.date} className="text-xs text-slate-500">
                  {new Date(post.date).toLocaleDateString(global.dateLocale, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </time>
                <div className="flex flex-col gap-4">
                  <h3 className="text-lg font-semibold leading-6 text-slate-900">
                    {post.title}
                  </h3>
                  <p className="line-clamp-3 text-sm leading-6 text-slate-600">
                    {post.preview}
                  </p>
                </div>
                <div className="flex flex-col">
                  <div className="text-sm leading-6">
                    <div className="font-semibold text-slate-900">
                      {post.author.data.attributes.name}
                    </div>
                    <div className="text-slate-600">
                      {post.author.data.attributes.role}
                    </div>
                  </div>
                </div>
              </article>
            </Anchor>
          ))}
        </div>
      </div>
    </div>
  );
}
