const { createClient } = require("@supabase/supabase-js");

async function test() {
  const supabase = createClient(
    "https://ptdnoanvzpslbizusuje.supabase.co",
    "sb_publishable_EFWZ-sdMfK-lcj1gHUUCTQ_iTf80ciE",
    { auth: { persistSession: false } }
  );

  console.log("Testing signin...");
  const { data, error } = await supabase.auth.signInWithPassword({
    email: "test@example.com",
    password: "password123",
  });
  console.log("Result:", error ? error.message : "Success");
}

test();
