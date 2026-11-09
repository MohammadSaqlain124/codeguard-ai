function Div(el)
  if el.classes:includes("draftnote") then
    local out = {pandoc.RawBlock("latex", "\\begin{draftnote}")}
    for _, b in ipairs(el.content) do table.insert(out, b) end
    table.insert(out, pandoc.RawBlock("latex", "\\end{draftnote}"))
    return out
  end
end
