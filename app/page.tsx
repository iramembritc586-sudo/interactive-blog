import PhaserIntro from "@/src/features/intro-scene/components/PhaserIntro";

export default function Home() {
  return (
    <main className="w-full">
      <section className="h-screen w-full">
        <PhaserIntro />
      </section>

      <section className="min-h-screen bg-white px-8 py-20 text-black">
        <h1 className="mb-6 text-4xl font-bold">我的个人首页正文区</h1>
        <p className="mb-4">这里先作为第二层内容占位。</p >
        <p>后面会放 About、Blog、Projects、Contact。</p >
      </section>
    </main>
  );
}