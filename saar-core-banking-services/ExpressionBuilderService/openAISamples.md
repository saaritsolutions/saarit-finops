curl -s -i -H "Authorization: Bearer -H "Content-Type: application/json" -d '{"model":"gpt-5-nano","input":[{"role":"system","content":"You are concise."},{"role":"user","content":"Return ONLY a one-line loan eligibility expression using creditScore and monthlyIncome. Max 140 chars. No quotes."}],"max_output_tokens":6400}' https://api.openai.com/v1/responses | sed -n '1,40p'



----------------------

curl https://api.openai.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer 
  -d '{
    "model": "gpt-5-nano",
     "response_format": { "type": "json_object" },
    "messages": [
      {
        "role": "system",
        "content": "You are a rule engine. Return exactly one valid rule — nothing else. The JSON must contain a Roslyn-parsable C# rule for loan eligibility and no metadata."
      },
      {
        "role": "user",
        "content": "Create a simple loan eligibility rule as JSON."
      }
    ]
  }'