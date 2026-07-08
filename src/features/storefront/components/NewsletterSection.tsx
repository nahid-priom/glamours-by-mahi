export function NewsletterSection() {
  return (
    <section className="px-4 py-16 sm:px-6 lg:py-20">
      <div className="mx-auto max-w-2xl rounded-2xl bg-[#111111] px-8 py-12 text-center text-white sm:px-12">
        <p className="text-[11px] uppercase tracking-[0.35em] text-white/50">Stay in the loop</p>
        <h2 className="mt-3 font-serif text-3xl">Join Our Newsletter</h2>
        <p className="mt-3 text-sm text-white/60">Early access to new arrivals, exclusive offers, and style edits.</p>
        <form className="mt-8 flex flex-col gap-3 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
          <input
            type="email"
            placeholder="Your email address"
            className="flex-1 rounded-full border-0 bg-white/10 px-5 py-3.5 text-sm text-white placeholder:text-white/40 outline-none focus:ring-2 focus:ring-[#E11D48]"
          />
          <button
            type="submit"
            className="rounded-full bg-[#E11D48] px-8 py-3.5 text-sm font-medium transition hover:bg-[#E11D48]/90"
          >
            Subscribe
          </button>
        </form>
      </div>
    </section>
  )
}
