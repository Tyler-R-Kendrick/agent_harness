---
name: simplify
description: Simplify and harden existing codebases using Clean Code, Clean Architecture, SOLID, KISS, DRY, and package-first refactoring. Use this whenever the user asks to simplify code, refactor a module, reduce complexity, remove duplication, untangle architecture, replace custom infrastructure with a library, or clean up design patterns, even if they only say "make this cleaner" or "reduce technical debt".
argument-hint: target area, invariants to preserve, dependency constraints, and whether new libraries are allowed
---

# Codebase Simplifier

Use this skill to reduce maintenance burden in an existing codebase.

Bias toward deleting code, clarifying boundaries, and adopting proven libraries before introducing new home-grown abstractions.

## Goals

- Reduce the amount of custom code the team must own.
- Make responsibilities narrower and easier to explain.
- Preserve behavior while lowering conceptual load.
- Use formal design patterns only when they clearly simplify variation or boundaries.

## Core Principles

- Prefer the smallest change that produces a simpler design.
- Favor net code reduction over code movement.
- Apply SOLID to remove reasons-to-change collisions, not to justify extra layers.
- Apply KISS by removing branches, abstractions, and configuration that do not earn their keep.
- Apply DRY to duplicated decisions and business rules, not to every repeated line.
- Do not reinvent commodity infrastructure. Prefer maintained packages for validation, parsing, retries, serialization, state machines, caching, auth, date handling, and similar cross-cutting concerns.
- If a design pattern is warranted, implement it completely and name the participants correctly. If the pattern would be ceremonial, remove indirection instead.
- Keep architectural dependencies moving inward toward domain and use-case logic.

## When To Reach For This Skill

Use this skill when the code shows one or more of these symptoms:

- Large functions or classes with multiple responsibilities
- Repeated branching logic for the same concept in multiple places
- Homemade infrastructure that duplicates common library behavior
- Framework or transport details leaking into business logic
- Partial or informal design patterns that create confusion
- Excessive pass-through wrappers, adapters, or indirection layers
- Tight coupling between orchestration, I/O, and domain rules
- A feature area that is hard to test because dependencies are tangled

## Workflow

### 1. Frame The Invariants

Before editing, identify:

- What behavior must remain unchanged
- Which tests already protect that behavior
- Which interfaces, schemas, or user-visible outputs are stable constraints
- Whether adding a dependency is allowed in this area

If tests are weak, add or update the minimum coverage needed to refactor safely.

### 2. Diagnose The Real Complexity

Map the current shape before proposing a fix:

- Entry points and callers
- Responsibility boundaries
- External dependencies and framework touchpoints
- Repeated rules, transformations, or conditionals
- Custom infrastructure that looks like a commodity problem

Classify the issue before acting:

- Responsibility problem: one unit changes for multiple reasons
- Duplication problem: the same rule is encoded in multiple places
- Boundary problem: domain logic knows too much about transport, storage, or UI
- Variation problem: type-based branching or mode switching is spreading
- NIH problem: custom code duplicates a mature package
- Ceremony problem: abstractions exceed real variation and should be collapsed

### 3. Choose The Lowest-Maintenance Move

Prefer options in this order:

1. Delete dead code, dead branches, and pass-through layers.
2. Inline unnecessary abstractions and collapse speculative interfaces.
3. Extract cohesive responsibilities into smaller units.
4. Replace commodity custom code with a mature library.
5. Introduce a formal pattern only when it removes active complexity.
6. Introduce architectural boundaries only where dependency direction or testability needs them.

Do not add new layers unless they remove more complexity than they introduce.

### 4. Apply The Right Refactor

Use these decision rules.

#### Split Responsibility

Use when a class or function has multiple reasons to change.

- Separate orchestration from business rules.
- Separate parsing or transport mapping from domain decisions.
- Replace boolean flags and mode parameters with distinct collaborators when they represent different behaviors.

#### Remove Duplication

Use when the same decision or algorithm appears in multiple paths.

- Centralize the rule at the level where the concept belongs.
- Prefer shared domain helpers or value objects over utility dumping grounds.
- Do not create a shared abstraction if the duplication is accidental and temporary.

#### Introduce A Library

Use when the team is maintaining generic infrastructure.

Choose a package only if it is:

- Well maintained
- Widely used or otherwise credible
- Compatible with project licensing and runtime constraints
- Smaller in long-term cost than the custom code it replaces

When a package is adopted:

- Replace the custom implementation instead of wrapping both forever.
- Keep any project-specific policy in a thin local layer.
- Document why this package was chosen if the tradeoff is not obvious.

#### Formalize A Pattern

Use patterns to simplify recurring variation, not to perform architecture theater.

Good candidates:

- Strategy: repeated conditional behavior selected by type, mode, or policy
- Adapter: external API shape does not match the local boundary
- Facade: a subsystem is too noisy for its callers
- Decorator: behavior should be layered without subclass explosion
- State: state-dependent behavior is spreading across conditionals
- Factory: construction logic is branching or requires boundary-specific assembly

Pattern rules:

- Name the roles clearly.
- Implement all essential participants.
- Update call sites to use the pattern consistently.
- If only one variant exists, do not force a strategy or factory yet.

#### Clarify Architecture

Use Clean Architecture boundaries where they buy isolation.

- Keep entities and core business rules independent from frameworks.
- Let use cases orchestrate application behavior.
- Let adapters translate storage, HTTP, UI, or messaging concerns.
- Depend inward through explicit seams only where the seam provides value.
- Avoid leaking framework DTOs or persistence models into core logic.

### 5. Verify That The Design Actually Simplified

Before finishing, check:

- The change reduced concepts, branches, files, or dependency entanglement, or it made responsibility boundaries materially clearer.
- Domain rules live in fewer places.
- New packages removed more code and risk than they added.
- Any introduced pattern is complete and consistently applied.
- Names explain intent without requiring architectural folklore.
- Tests cover the preserved behavior and pass.
- Docs or configuration changed only where necessary.

If the result is only different, not simpler, keep refactoring.

## Output Structure

When using this skill, respond in this order:

1. Simplification diagnosis
2. Recommended move and why it beats heavier alternatives
3. Code to delete, collapse, extract, or replace
4. Package recommendation, if any
5. Pattern or boundary adjustments, if any
6. Verification steps

## Guardrails

- Do not introduce interfaces for hypothetical future variants.
- Do not keep legacy and replacement implementations in parallel longer than necessary.
- Do not hide simple logic behind generic manager, helper, or service names.
- Do not add a dependency when a few lines of obvious code are cheaper to own.
- Do not call something a pattern unless the structure is actually present.

## Example Prompts

- Simplify this feature module and reduce the amount of infrastructure code we maintain.
- Refactor this service toward clean architecture without adding useless layers.
- Replace our homemade retry and validation logic with libraries if that reduces maintenance burden.
- Clean up this pattern implementation. If it is not a real pattern yet, either formalize it or remove it.