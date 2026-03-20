export const metadata = {
  title: "Blog | Interactive Blog",
};

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Blog</h1>
      <p className="text-neutral-600 dark:text-neutral-400">
        文章列表占位。后续可接入 MDX、CMS 或静态生成。
      </p>
    </div>
  );
}
