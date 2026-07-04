# Represent playable content as typed Article Documents

Wiki Duel converts untrusted Wikipedia HTML into a typed, allowlisted Article Document on the server rather than sending sanitized HTML to clients. This deliberately trades some source fidelity and additional normalization code for a smaller browser trust boundary, explicit Navigation actions, and application-controlled semantic rendering; Wikipedia HTML remains an adapter input and never becomes the client contract.
