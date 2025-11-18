/**
 * Test fixture: Deeply nested structures
 * 
 * Tests:
 * - Deep object nesting
 * - Deep function nesting
 * - Deep class nesting
 * - Deep type nesting
 */

// Deeply nested object
export const deeplyNestedConfig = {
  level1: {
    level2: {
      level3: {
        level4: {
          level5: {
            level6: {
              level7: {
                level8: {
                  level9: {
                    level10: {
                      value: 'deeply nested value',
                      settings: {
                        enabled: true,
                        options: {
                          advanced: {
                            features: {
                              experimental: {
                                flags: {
                                  newFeature: true
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// Deeply nested functions (closures)
export function level1() {
  const var1 = 'level1'
  
  function level2() {
    const var2 = 'level2'
    
    function level3() {
      const var3 = 'level3'
      
      function level4() {
        const var4 = 'level4'
        
        function level5() {
          const var5 = 'level5'
          
          function level6() {
            const var6 = 'level6'
            
            function level7() {
              const var7 = 'level7'
              
              function level8() {
                const var8 = 'level8'
                
                return {
                  var1, var2, var3, var4, var5, var6, var7, var8
                }
              }
              
              return level8()
            }
            
            return level7()
          }
          
          return level6()
        }
        
        return level5()
      }
      
      return level4()
    }
    
    return level3()
  }
  
  return level2()
}

// Deeply nested types
export type DeepType = {
  a: {
    b: {
      c: {
        d: {
          e: {
            f: {
              g: {
                h: {
                  i: {
                    j: string
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

// Deeply nested class hierarchy
export class Level1 {
  class Level2 {
    class Level3 {
      class Level4 {
        class Level5 {
          getValue(): string {
            return 'deeply nested class'
          }
        }
      }
    }
  }
}

// Deeply nested conditional types
export type DeepConditional<T> = 
  T extends { a: infer A }
    ? A extends { b: infer B }
      ? B extends { c: infer C }
        ? C extends { d: infer D }
          ? D extends { e: infer E }
            ? E extends { f: infer F }
              ? F
              : never
            : never
          : never
        : never
      : never
    : never

// Deeply nested array
export const deepArray = [
  [
    [
      [
        [
          [
            [
              [
                [
                  [
                    'deeply nested value'
                  ]
                ]
              ]
            ]
          ]
        ]
      ]
    ]
  ]
]

// Deeply nested ternary operators
export function deepTernary(value: number): string {
  return value > 100
    ? value > 200
      ? value > 300
        ? value > 400
          ? value > 500
            ? 'very high'
            : 'high'
          : 'medium-high'
        : 'medium'
      : 'low-medium'
    : 'low'
}

